import type { ScripturePassage, SupportingSource, Translation } from './contracts';

/**
 * The local, editorially-reviewed corpus.
 *
 * Everything here is public domain. That is a deliberate licensing decision,
 * not a placeholder: Icthus must never ship copyrighted Bible text or scraped
 * content. When YouVersion credentials and a content licence are in place, the
 * YouVersion adapter supplies licensed translations instead and this corpus
 * stays as the offline/degraded fallback.
 */

export const WEB_TRANSLATION: Translation = {
  id: 'web',
  name: 'World English Bible',
  abbreviation: 'WEB',
  rights: 'Public domain. No permission required for reproduction.',
};

type CorpusPassage = Omit<ScripturePassage, 'provider' | 'providerState'> & {
  /** Retrieval keys. Deliberately plain language, not theological jargon. */
  themes: readonly string[];
};

const passage = (input: CorpusPassage): CorpusPassage => input;

export const SCRIPTURE_CORPUS: readonly CorpusPassage[] = [
  passage({
    sourceId: 'web:matthew-11-28',
    reference: 'Matthew 11:28-30',
    canonical: { book: 'Matthew', chapter: 11, verseStart: 28, verseEnd: 30 },
    text: '“Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and lowly in heart; and you will find rest for your souls. For my yoke is easy, and my burden is light.”',
    context:
      'Jesus has just contrasted the towns that would not receive him with the "little children" to whom the Father reveals himself. The invitation lands on people who are tired, not people who have succeeded.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/MAT11.htm',
    themes: ['weariness', 'burden', 'exhaustion', 'overwhelm', 'rest', 'anxiety'],
  }),
  passage({
    sourceId: 'web:psalm-34-18',
    reference: 'Psalm 34:18',
    canonical: { book: 'Psalm', chapter: 34, verseStart: 18, verseEnd: null },
    text: 'Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.',
    context:
      'David writes this psalm after escaping danger by feigning madness. The nearness he describes is not a reward for composure — it is offered precisely to the crushed.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/PSA34.htm',
    themes: ['grief', 'heartbreak', 'loss', 'sorrow', 'despair', 'loneliness'],
  }),
  passage({
    sourceId: 'web:philippians-4-6',
    reference: 'Philippians 4:6-7',
    canonical: { book: 'Philippians', chapter: 4, verseStart: 6, verseEnd: 7 },
    text: 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.',
    context:
      'Paul writes from prison to a church he loves. The instruction is not to feel differently by force, but to move the worry somewhere — to name it in prayer rather than carry it silently.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/PHP04.htm',
    themes: ['anxiety', 'worry', 'fear', 'stress', 'panic', 'peace'],
  }),
  passage({
    sourceId: 'web:matthew-6-33',
    reference: 'Matthew 6:33-34',
    canonical: { book: 'Matthew', chapter: 6, verseStart: 33, verseEnd: 34 },
    text: 'But seek first God’s Kingdom and his righteousness; and all these things will be given to you as well. Therefore don’t be anxious for tomorrow, for tomorrow will be anxious for itself. Each day’s own evil is sufficient.',
    context:
      'The close of a long passage about food, clothing, and the birds of the air. Jesus is speaking to ordinary material worry, not abstract priorities.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/MAT06.htm',
    themes: ['work', 'ambition', 'provision', 'priorities', 'money', 'striving', 'discernment'],
  }),
  passage({
    sourceId: 'web:lamentations-3-22',
    reference: 'Lamentations 3:22-23',
    canonical: { book: 'Lamentations', chapter: 3, verseStart: 22, verseEnd: 23 },
    text: 'It is because of Yahweh’s loving kindnesses that we are not consumed, because his compassion doesn’t fail. They are new every morning. Great is your faithfulness.',
    context:
      'These lines sit in the middle of a book of grief over a ruined city. The hope is not a denial of the ruin; it is spoken from inside it.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/LAM03.htm',
    themes: ['hope', 'despair', 'endurance', 'morning', 'faithfulness', 'starting over'],
  }),
  passage({
    sourceId: 'web:isaiah-41-10',
    reference: 'Isaiah 41:10',
    canonical: { book: 'Isaiah', chapter: 41, verseStart: 10, verseEnd: null },
    text: 'Don’t you be afraid, for I am with you. Don’t be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.',
    context:
      'Spoken to a people facing exile and a stronger enemy. The comfort offered is presence and help, not the removal of the threat.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/ISA41.htm',
    themes: ['fear', 'courage', 'uncertainty', 'change', 'strength'],
  }),
  passage({
    sourceId: 'web:1-thessalonians-5-16',
    reference: '1 Thessalonians 5:16-18',
    canonical: { book: '1 Thessalonians', chapter: 5, verseStart: 16, verseEnd: 18 },
    text: 'Always rejoice. Pray without ceasing. In everything give thanks, for this is the will of God in Christ Jesus toward you.',
    context:
      'The closing instructions of a letter to a young, pressured church. "In everything" is not "for everything" — gratitude here sits alongside hardship rather than replacing it.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/1TH05.htm',
    themes: ['gratitude', 'thanksgiving', 'joy', 'celebration', 'praise'],
  }),
  passage({
    sourceId: 'web:matthew-18-21',
    reference: 'Matthew 18:21-22',
    canonical: { book: 'Matthew', chapter: 18, verseStart: 21, verseEnd: 22 },
    text: 'Then Peter came and said to him, “Lord, how often shall my brother sin against me, and I forgive him? Until seven times?” Jesus said to him, “I don’t tell you until seven times, but, until seventy times seven.”',
    context:
      'Peter thinks he is being generous. The answer reframes forgiveness from a quota to be met into a direction to keep walking.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/MAT18.htm',
    themes: ['forgiveness', 'resentment', 'conflict', 'relationships', 'bitterness'],
  }),
  passage({
    sourceId: 'web:james-1-5',
    reference: 'James 1:5-6',
    canonical: { book: 'James', chapter: 1, verseStart: 5, verseEnd: 6 },
    text: 'But if any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him. But let him ask in faith, without any doubting.',
    context:
      'Written to scattered believers under pressure. The promise is not certainty about outcomes but wisdom for the next step, given "without reproach" — without being made to feel foolish for asking.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/JAM01.htm',
    themes: ['question', 'confusion', 'decision', 'discernment', 'wisdom', 'doubt'],
  }),
  passage({
    sourceId: 'web:psalm-139-1',
    reference: 'Psalm 139:1-3',
    canonical: { book: 'Psalm', chapter: 139, verseStart: 1, verseEnd: 3 },
    text: 'Yahweh, you have searched me, and you know me. You know my sitting down and my rising up. You perceive my thoughts from afar. You search out my path and my lying down, and are acquainted with all my ways.',
    context:
      'A psalm about being fully known. It is often read as comfort and sometimes as exposure; the psalm itself holds both without resolving the tension.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/PSA139.htm',
    themes: ['loneliness', 'isolation', 'being known', 'identity', 'shame'],
  }),
  passage({
    sourceId: 'web:1-corinthians-10-13',
    reference: '1 Corinthians 10:13',
    canonical: { book: '1 Corinthians', chapter: 10, verseStart: 13, verseEnd: null },
    text: 'No temptation has taken you except what is common to man. God is faithful, who will not allow you to be tempted above what you are able, but will with the temptation also make the way of escape, that you may be able to endure it.',
    context:
      'Paul is writing to a divided church about pressure from the surrounding culture. The first move is de-isolating: this is "common to man," not evidence that you are uniquely broken.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/1CO10.htm',
    themes: ['temptation', 'struggle', 'habit', 'shame', 'endurance'],
  }),
  passage({
    sourceId: 'web:proverbs-3-5',
    reference: 'Proverbs 3:5-6',
    canonical: { book: 'Proverbs', chapter: 3, verseStart: 5, verseEnd: 6 },
    text: 'Trust in Yahweh with all your heart, and don’t lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.',
    context:
      'Wisdom literature addressed to a young person making early decisions. "Don’t lean on your own understanding" is a caution against certainty, not against thinking.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/PRO03.htm',
    themes: ['decision', 'discernment', 'direction', 'calling', 'purpose', 'uncertainty'],
  }),
  passage({
    sourceId: 'web:john-11-33',
    reference: 'John 11:33-35',
    canonical: { book: 'John', chapter: 11, verseStart: 33, verseEnd: 35 },
    text: 'When Jesus therefore saw her weeping, and the Jews weeping who came with her, he groaned in the spirit, and was troubled, and said, “Where have you laid him?” They told him, “Lord, come and see.” Jesus wept.',
    context:
      'Jesus is minutes away from raising Lazarus. He weeps anyway. The grief is not made unnecessary by knowing how it ends.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/JHN11.htm',
    themes: ['grief', 'death', 'mourning', 'loss', 'tears'],
  }),
  passage({
    sourceId: 'web:ecclesiastes-4-9',
    reference: 'Ecclesiastes 4:9-10',
    canonical: { book: 'Ecclesiastes', chapter: 4, verseStart: 9, verseEnd: 10 },
    text: 'Two are better than one, because they have a good reward for their labor. For if they fall, the one will lift up his fellow; but woe to him who is alone when he falls, and doesn’t have another to lift him up.',
    context:
      'A book that stares hard at futility pauses here to make a plain, practical observation about company.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/ECC04.htm',
    themes: ['loneliness', 'community', 'friendship', 'isolation', 'help'],
  }),
  passage({
    sourceId: 'web:john-14-27',
    reference: 'John 14:27',
    canonical: { book: 'John', chapter: 14, verseStart: 27, verseEnd: null },
    text: 'Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don’t let your heart be troubled, neither let it be fearful.',
    context:
      'Spoken on the last night before the crucifixion, to friends who are about to lose him. The peace offered is explicitly not the world’s kind — not the absence of trouble.',
    translation: WEB_TRANSLATION,
    attribution: 'World English Bible (public domain)',
    canonicalUrl: 'https://ebible.org/web/JHN14.htm',
    themes: ['peace', 'fear', 'anxiety', 'comfort', 'hope'],
  }),
] as const;

export const SUPPORTING_SOURCE_CORPUS: readonly SupportingSource[] = [
  {
    sourceId: 'ccel:augustine-confessions-1-1',
    kind: 'historic_witness',
    title: 'Confessions',
    author: 'Augustine of Hippo',
    locator: 'Book I, Chapter 1',
    edition: 'Pusey translation, 1838',
    excerpt: 'You have made us for yourself, and our heart is restless until it rests in you.',
    tradition: null,
    canonicalUrl: 'https://www.ccel.org/ccel/augustine/confessions.html',
    rights: 'Public domain',
  },
  {
    sourceId: 'ccel:kempis-imitation-1-1',
    kind: 'historic_witness',
    title: 'The Imitation of Christ',
    author: 'Thomas à Kempis',
    locator: 'Book I, Chapter 1',
    edition: 'Benham translation, 1905',
    excerpt:
      'A humble countryman who serves God is better than a proud philosopher who watches the stars and neglects the knowledge of himself.',
    tradition: null,
    canonicalUrl: 'https://www.ccel.org/ccel/kempis/imitation.html',
    rights: 'Public domain',
  },
  {
    sourceId: 'ccel:julian-revelations-27',
    kind: 'historic_witness',
    title: 'Revelations of Divine Love',
    author: 'Julian of Norwich',
    locator: 'Chapter 27',
    edition: 'Warrack edition, 1901',
    excerpt: 'All shall be well, and all shall be well, and all manner of thing shall be well.',
    tradition: null,
    canonicalUrl: 'https://www.ccel.org/ccel/julian/revelations.html',
    rights: 'Public domain',
  },
  {
    sourceId: 'ccel:brother-lawrence-presence-4',
    kind: 'historic_witness',
    title: 'The Practice of the Presence of God',
    author: 'Brother Lawrence of the Resurrection',
    locator: 'Fourth Conversation',
    edition: 'Fleming H. Revell edition, 1895',
    excerpt:
      'We ought not to be weary of doing little things for the love of God, who regards not the greatness of the work, but the love with which it is performed.',
    tradition: null,
    canonicalUrl: 'https://www.ccel.org/ccel/lawrence/practice.html',
    rights: 'Public domain',
  },
  {
    sourceId: 'ccel:chrysostom-homilies-matthew-38',
    kind: 'historic_witness',
    title: 'Homilies on the Gospel of Matthew',
    author: 'John Chrysostom',
    locator: 'Homily 38',
    edition: 'Nicene and Post-Nicene Fathers, Series I, Vol. X',
    excerpt:
      'Prayer is the light of the spirit, true knowledge of God, mediating between God and man.',
    tradition: null,
    canonicalUrl: 'https://www.ccel.org/ccel/schaff/npnf110.html',
    rights: 'Public domain',
  },
  {
    sourceId: 'ccel:teresa-bookmark',
    kind: 'historic_witness',
    title: 'The Bookmark of Saint Teresa',
    author: 'Teresa of Ávila',
    locator: 'Complete text',
    edition: 'Public-domain English rendering',
    excerpt:
      'Let nothing disturb you. Let nothing frighten you. All things are passing. God alone suffices.',
    tradition: 'Roman Catholic (Carmelite)',
    canonicalUrl: 'https://www.ccel.org/ccel/teresa/way.html',
    rights: 'Public domain',
  },
] as const;

const SUPPORT_BY_THEME: Record<string, readonly string[]> = {
  weariness: ['ccel:augustine-confessions-1-1', 'ccel:brother-lawrence-presence-4'],
  anxiety: ['ccel:teresa-bookmark', 'ccel:chrysostom-homilies-matthew-38'],
  grief: ['ccel:julian-revelations-27', 'ccel:augustine-confessions-1-1'],
  gratitude: ['ccel:brother-lawrence-presence-4'],
  forgiveness: ['ccel:kempis-imitation-1-1'],
  discernment: ['ccel:kempis-imitation-1-1', 'ccel:chrysostom-homilies-matthew-38'],
  loneliness: ['ccel:augustine-confessions-1-1', 'ccel:julian-revelations-27'],
  temptation: ['ccel:kempis-imitation-1-1'],
  hope: ['ccel:julian-revelations-27'],
  fear: ['ccel:teresa-bookmark'],
  peace: ['ccel:teresa-bookmark'],
};

export function findPassageBySourceId(sourceId: string): CorpusPassage | null {
  return SCRIPTURE_CORPUS.find((entry) => entry.sourceId === sourceId) ?? null;
}

export function findPassageByReferenceSlug(slug: string): CorpusPassage | null {
  const normalised = slug.trim().toLowerCase();
  return (
    SCRIPTURE_CORPUS.find((entry) => {
      const bookSlug = entry.canonical.book.toLowerCase().replace(/\s+/g, '-');
      const { chapter, verseStart, verseEnd } = entry.canonical;
      const withEnd = `${bookSlug}-${chapter}-${verseStart}-${verseEnd ?? verseStart}`;
      const withoutEnd = `${bookSlug}-${chapter}-${verseStart}`;
      return normalised === withEnd || normalised === withoutEnd;
    }) ?? null
  );
}

export function findSupportingSource(sourceId: string): SupportingSource | null {
  return SUPPORTING_SOURCE_CORPUS.find((entry) => entry.sourceId === sourceId) ?? null;
}

/**
 * Ranks corpus passages against a set of extracted themes. Deterministic by
 * design — the same input always produces the same passage, which is what makes
 * the offline path demonstrable and the tests meaningful.
 */
export function rankPassages(themes: readonly string[]): readonly CorpusPassage[] {
  const wanted = new Set(themes.map((t) => t.toLowerCase()));
  const scored = SCRIPTURE_CORPUS.map((entry) => {
    let score = 0;
    for (const theme of entry.themes) {
      if (wanted.has(theme)) score += 1;
    }
    return { entry, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Stable tiebreak so retrieval never depends on array order changes.
      return a.entry.sourceId.localeCompare(b.entry.sourceId);
    });
  return scored.map((row) => row.entry);
}

export function supportingSourcesForThemes(
  themes: readonly string[],
  limit: number,
): readonly SupportingSource[] {
  const ids: string[] = [];
  for (const theme of themes) {
    for (const id of SUPPORT_BY_THEME[theme.toLowerCase()] ?? []) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids
    .slice(0, limit)
    .map((id) => findSupportingSource(id))
    .filter((source): source is SupportingSource => source !== null);
}

export type { CorpusPassage };
