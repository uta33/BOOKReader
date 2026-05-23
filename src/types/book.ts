export interface Sentence {
  id: string;
  text: string;
  pageNumber: number;
}

export interface Book {
  id: string;
  title: string;
  uri: string;
  totalPages: number;
  sentences: Sentence[];
  lastSentenceIdx: number;
  cachedSentenceIds: string[];
  createdAt: number;
}
