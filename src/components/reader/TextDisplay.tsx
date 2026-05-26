import React, { useRef, useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Sentence } from '../../types/book';
import { SentenceBlock } from './SentenceBlock';

interface Props {
  sentences: Sentence[];
  currentIdx: number;
  onSentencePress: (idx: number) => void;
}

export function TextDisplay({ sentences, currentIdx, onSentencePress }: Props) {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (sentences.length === 0) return;
    try {
      listRef.current?.scrollToIndex({
        index: Math.min(currentIdx, sentences.length - 1),
        animated: true,
        viewPosition: 0.3,
      });
    } catch {
      // index not yet rendered — ignore
    }
  }, [currentIdx, sentences.length]);

  return (
    <FlatList
      ref={listRef}
      data={sentences}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <SentenceBlock
          text={item.text}
          isActive={index === currentIdx}
          onPress={() => onSentencePress(index)}
        />
      )}
      contentContainerStyle={styles.content}
      onScrollToIndexFailed={({ averageItemLength, index }) => {
        listRef.current?.scrollToOffset({
          offset: averageItemLength * index,
          animated: true,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20 },
});
