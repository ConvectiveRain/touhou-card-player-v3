/** How a card is drawn. Kept apart from the image urls: this is what the UI branches on. */
export enum CardBackgroundState {
  Placeholder,
  Normal,
  Hover,
  Disabled,
  DisabledHover,
  Selected,
  Correct,
  Incorrect,
}
