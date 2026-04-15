import raw from './words.json';

export type Word = {word: string; start: number; end: number};

export const WORDS: Word[] = raw as Word[];
