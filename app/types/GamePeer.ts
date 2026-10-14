import Peer, { DataConnection, PeerOptions } from "peerjs";
import { Event } from "./GameEvents";
import { decodeEvent, encodeEvent } from "./syncCodec";

/**
 * The WebRTC/PeerJS transport. Owns connections and (de)serialization only; it knows
 * nothing about game rules.
 */

export class ClientConnection {
  dataConnection: DataConnection | null;
  index: number;
  constructor(dataConnection: DataConnection | null, index: number) {
    this.dataConnection = dataConnection;
    this.index = index;
  }
}

export class GamePeer {
  peer: Peer | null;
  dataConnectionToServer: DataConnection | null;
  dataConnectionToClients: Array<ClientConnection>;
  refresh: () => void;
  notifyClientConnected: (id: number) => void;
  notifyClientDisconnected: (id: number) => void;
  notifyDisconnectedFromServer: () => void;
  notifyConnectedToServer: (peer: GamePeer) => void;
  notifyPeerError: (id: number, message: string) => void;
  /**
   * Invoked for every event received from a client. Assigned by the session, and read at
   * delivery time so it always routes to the current judge.
   */
  onEventFromClient: (clientIndex: number, event: Event) => void;
  /** Invoked for every event received from the server. */
  onEventFromServer: (event: Event) => void;

  constructor() {
    this.peer = null;
    this.dataConnectionToServer = null;
    this.dataConnectionToClients = [];
    this.refresh = () => {};
    this.notifyClientConnected = () => {};
    this.notifyClientDisconnected = (_id: number) => {};
    this.notifyDisconnectedFromServer = () => {};
    this.notifyConnectedToServer = () => {};
    this.notifyPeerError = (_id: number, _message: string) => {};
    this.onEventFromClient = () => {};
    this.onEventFromServer = () => {};
  }

  disconnect() {
    if (this.dataConnectionToServer) {
      this.dataConnectionToServer.close();
      this.dataConnectionToServer = null;
    }
    for (const conn of this.dataConnectionToClients) {
      conn.dataConnection?.close();
    }
    this.dataConnectionToClients = [];
  }

  connectToServer(peerId: string) {
    this.ensurePeerNotNull();
    const dataConnection = this.peer!.connect(peerId);

    // Attach the data listener now, not on "open": the server sends its settings as soon
    // as its side opens, so a message can arrive before a later listener would be bound.
    dataConnection.on("data", (data: unknown) => {
      const event = decodeEvent(data);
      if (event === null) {
        console.error("[GamePeer] Discarding malformed event from server:", data);
        return;
      }
      this.onEventFromServer(event);
    });

    dataConnection.on("error", (err) => {
      console.error("[GamePeer] DataConnection error:", err);
      this.notifyPeerError(0, `Cannot connect to server: ${err}`);
    });

    dataConnection.on("open", () => {
      // connected to server
      if (!this.dataConnectionToServer) {
        this.dataConnectionToServer = dataConnection;
        this.notifyConnectedToServer(this);
        this.refresh();
      }
    });

    dataConnection.on("close", () => {
      this.dataConnectionToServer = null;
      this.notifyDisconnectedFromServer();
    });

  }

  hasConnectionToServer(): boolean {
    return this.dataConnectionToServer !== null;
  }

  ensurePeerNotNull(forceReconstructPeer: boolean = false) {
    if (this.peer === null || forceReconstructPeer) {
      this.peer = new Peer({
        'iceServers': [
          { 'urls': 'stun:stun.servcices.mozilla.com' }
        ],
        'sdpSemantics': 'unified-plan'
      } as PeerOptions);

      this.peer.on("error", (err) => {
        console.error("[GamePeer] Peer error:", err);
        this.notifyPeerError(0, `Peer error: ${err}`);
      });

      this.peer.on("open", (_: string) => {
        this.refresh();
      });

      this.peer.on("connection", (conn: DataConnection) => {

        // Attach the data listener as soon as the connection exists so no event from the
        // client can be dropped while React re-renders and re-registers the connection.
        conn.on("data", (data: unknown) => {
          const event = decodeEvent(data);
          if (event === null) {
            console.error("[GamePeer] Discarding malformed event from client:", data);
            return;
          }
          const clientIndex = this.clientIndexFor(conn);
          if (clientIndex === null) {
            console.warn("[GamePeer] Ignoring event from an unregistered connection:", event);
            return;
          }
          this.onEventFromClient(clientIndex, event);
        });

        // connection from clients
        conn.on("open", () => {
          this.dataConnectionToClients.push(new ClientConnection(
            conn, this.dataConnectionToClients.length + 1
          ));
          this.notifyClientConnected(this.dataConnectionToClients.length);
          this.refresh();
        });

        conn.on("close", () => {
          const index = this.dataConnectionToClients.findIndex(
            (clientConn) => clientConn.dataConnection === conn,
          );
          if (index !== -1) {
            const toRemove = this.dataConnectionToClients[index];
            this.dataConnectionToClients.splice(index, 1);
            this.notifyClientDisconnected(toRemove.index);
          }
          conn.removeAllListeners("data");
          this.refresh();
        });

        console.log("[GamePeer] Incoming connection from peer:", conn.peer);
        this.refresh();

      });

      this.peer.on("disconnected", () => {
        this.dataConnectionToServer = null;
        for (const conn of this.dataConnectionToClients) {
          conn.dataConnection?.removeAllListeners("data");
        }
        this.dataConnectionToClients = [];
        // remove peer so that a new one can be created
        this.peer = null;
      });

    }
  }

  getId(): string {
    this.ensurePeerNotNull();
    return this.peer!.id;
  }

  sendEventToServer(payload: Event) {
    if (!this.hasConnectionToServer()) {
      console.warn("No connection to server available to send event:", payload);
      return;
    }
    console.log("server <=", payload);
    this.dataConnectionToServer!.send(encodeEvent(payload));
  }

  sendEventToClient(payload: Event, clientId: number) {
    const conn = this.dataConnectionToClients.find((c) => c.index === clientId);
    if (!conn) {
      console.warn(`No client connection with id ${clientId} available to send event:`, payload);
      return;
    }
    console.log(`client ${clientId} <=`, payload);
    conn.dataConnection?.send(encodeEvent(payload));
  }

  sendEventToClients(payload: Event, exceptId: number | null = null) {
    if (this.dataConnectionToClients.length === 0) {
      console.warn("No client connections available to send event:", payload);
      return;
    }
    if (exceptId !== null) {
      console.log(`clients (except ${exceptId}) <=`, payload);
    } else {
      console.log("clients <=", payload);
    }
    this.dataConnectionToClients.forEach((conn) => {
      if (exceptId !== null && conn.index === exceptId) {
        return;
      }
      conn.dataConnection?.send(encodeEvent(payload));
    });
  }

  /** Index of the registered client for a connection, or null before it is registered. */
  private clientIndexFor(conn: DataConnection): number | null {
    const entry = this.dataConnectionToClients.find(
      (clientConn) => clientConn.dataConnection === conn,
    );
    return entry ? entry.index : null;
  }
}
