export enum YaoState {
  YoungYang = 0,
  YoungYin = 1,
  OldYang = 2,
  OldYin = 3,
  OldMixed = 4,
  YoungMixed = 5,
}

export interface ContextCard {
  lineIndex: number;
  title?: string;
  content?: string;
  state: YaoState;
  importance: number;
}
