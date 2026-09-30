import { londonDateKey, seededRandom } from '@/lib/games/common';

export type ScrambleDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ScrambleCategory = 'Food' | 'Places' | 'Technology' | 'Nature' | 'Entertainment' | 'General';

export type ScrambleWord = {
  word: string;
  hint: string;
  category: ScrambleCategory;
  difficulty: ScrambleDifficulty;
};

export const WORD_BANK: readonly ScrambleWord[] = [
  { word: 'APPLE', hint: 'A crisp fruit that can be red or green', category: 'Food', difficulty: 'Easy' },
  { word: 'PIZZA', hint: 'A round meal often topped with cheese', category: 'Food', difficulty: 'Easy' },
  { word: 'TIGER', hint: 'A big cat with orange and black stripes', category: 'Nature', difficulty: 'Easy' },
  { word: 'RIVER', hint: 'A flowing body of water', category: 'Nature', difficulty: 'Easy' },
  { word: 'MUSIC', hint: 'Sounds made with rhythm and melody', category: 'Entertainment', difficulty: 'Easy' },
  { word: 'PLANT', hint: 'A living thing that grows in soil', category: 'Nature', difficulty: 'Easy' },
  { word: 'BEACH', hint: 'A sandy place beside the sea', category: 'Places', difficulty: 'Easy' },
  { word: 'CHAIR', hint: 'A seat made for one person', category: 'General', difficulty: 'Easy' },
  { word: 'BREAD', hint: 'A baked food often used for sandwiches', category: 'Food', difficulty: 'Easy' },
  { word: 'CLOUD', hint: 'A fluffy-looking shape floating in the sky', category: 'Nature', difficulty: 'Easy' },
  { word: 'GARDEN', hint: 'An outdoor space where flowers and vegetables grow', category: 'Places', difficulty: 'Medium' },
  { word: 'BANANA', hint: 'A yellow fruit with a peel', category: 'Food', difficulty: 'Medium' },
  { word: 'ROCKET', hint: 'A vehicle that can travel into space', category: 'Technology', difficulty: 'Medium' },
  { word: 'CASTLE', hint: 'A large historic building with towers', category: 'Places', difficulty: 'Medium' },
  { word: 'PENCIL', hint: 'A writing tool you can sharpen', category: 'General', difficulty: 'Medium' },
  { word: 'CAMERA', hint: 'A device used to take pictures', category: 'Technology', difficulty: 'Medium' },
  { word: 'PUZZLE', hint: 'A game or problem made of pieces or clues', category: 'Entertainment', difficulty: 'Medium' },
  { word: 'FOREST', hint: 'A large area filled with trees', category: 'Nature', difficulty: 'Medium' },
  { word: 'NOODLE', hint: 'A long strip of pasta often served in a bowl', category: 'Food', difficulty: 'Medium' },
  { word: 'PLANET', hint: 'A large world that orbits a star', category: 'Nature', difficulty: 'Medium' },
  { word: 'RAINBOW', hint: 'A colourful arc that can appear after rain', category: 'Nature', difficulty: 'Hard' },
  { word: 'THEATRE', hint: 'A place where people watch live performances', category: 'Entertainment', difficulty: 'Hard' },
  { word: 'BICYCLE', hint: 'A two-wheeled vehicle powered by pedals', category: 'Technology', difficulty: 'Hard' },
  { word: 'LIBRARY', hint: 'A quiet place where you can borrow books', category: 'Places', difficulty: 'Hard' },
  { word: 'POPCORN', hint: 'A crunchy snack often enjoyed at the cinema', category: 'Food', difficulty: 'Hard' },
  { word: 'DOLPHIN', hint: 'A clever sea mammal that can leap from the water', category: 'Nature', difficulty: 'Hard' },
  { word: 'JOURNEY', hint: 'A trip from one place to another', category: 'General', difficulty: 'Hard' },
  { word: 'KEYBOARD', hint: 'A set of keys used to type on a computer', category: 'Technology', difficulty: 'Hard' },
  { word: 'BASEBALL', hint: 'A bat-and-ball game played by two teams', category: 'Entertainment', difficulty: 'Hard' },
  { word: 'MOUNTAIN', hint: 'A very high natural area of land', category: 'Nature', difficulty: 'Hard' },
];

/** Return a display-ready answer comparison, ignoring spaces, punctuation and letter case. */
export function normalizeAnswer(answer: string): string {
  return answer.toLocaleUpperCase().replace(/[^A-Z]/g, '');
}

/** Shuffle letters with a supplied random source, ensuring a different arrangement when possible. */
export function scrambleWord(word: string, random: () => number = Math.random): string {
  const letters = [...word.toLocaleUpperCase()];
  if (letters.length < 2 || new Set(letters).size < 2) return letters.join('');
  let shuffled = [...letters];
  for (let attempt = 0; attempt < 12 && shuffled.join('') === letters.join(''); attempt += 1) {
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  if (shuffled.join('') === letters.join('')) {
    shuffled = [...letters.slice(1), letters[0]];
  }
  return shuffled.join('');
}

/** Build a stable daily set of ten different words for a London calendar date. */
export function createDailySequence(date: Date = new Date(), difficulty?: ScrambleDifficulty): ScrambleWord[] {
  const dayKey = londonDateKey(date);
  const pool = WORD_BANK.filter((entry) => !difficulty || entry.difficulty === difficulty);
  const random = seededRandom(`word-scramble-${dayKey}-${difficulty ?? 'all'}`);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(10, shuffled.length));
}

/** Choose one word at random from the selected level. */
export function chooseRandomWord(difficulty: ScrambleDifficulty, random: () => number = Math.random): ScrambleWord {
  const pool = WORD_BANK.filter((entry) => entry.difficulty === difficulty);
  return pool[Math.floor(random() * pool.length)];
}