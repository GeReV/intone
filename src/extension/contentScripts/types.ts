export interface Doc {
  getTexts(index: number): Promise<string[] | null>;
}
