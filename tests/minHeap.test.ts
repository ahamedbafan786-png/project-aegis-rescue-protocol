import { describe, expect, it } from 'vitest';
import { MinHeap } from '../src/algorithms/minHeap';

describe('MinHeap', () => {
  it('should pop elements in ascending order of priority', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    const nums = [15, 3, 2, 8, 1, 9, 4];
    nums.forEach((n) => heap.push(n));

    const result: number[] = [];
    while (!heap.isEmpty()) {
      result.push(heap.pop()!);
    }

    expect(result).toEqual([1, 2, 3, 4, 8, 9, 15]);
  });

  it('should handle peek and size correctly', () => {
    const heap = new MinHeap<{ id: string; val: number }>((a, b) => a.val - b.val);
    expect(heap.isEmpty()).toBe(true);
    expect(heap.size).toBe(0);
    expect(heap.peek()).toBeUndefined();

    heap.push({ id: 'B', val: 20 });
    heap.push({ id: 'A', val: 5 });
    heap.push({ id: 'C', val: 12 });

    expect(heap.size).toBe(3);
    expect(heap.peek()?.id).toBe('A');
    expect(heap.pop()?.id).toBe('A');
    expect(heap.size).toBe(2);
    expect(heap.peek()?.id).toBe('C');
  });

  it('should clear all items', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(10);
    heap.push(5);
    heap.clear();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.pop()).toBeUndefined();
  });
});
