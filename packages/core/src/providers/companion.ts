import {
  validateCompanionResult,
  type Citation,
  type CompanionResult,
  type MemoryInsight,
  type ProviderState,
  type Purpose,
  type ScripturePassage,
  type SupportingSource,
} from '../contracts';
import { supportingSourcesForThemes } from '../corpus';
import { PASTORAL_NOTE, SUPPORT_COPY, SUPPORT_RESOURCES, classifySafety } from '../safety';
import { retrievalThemes } from '../themes';
import type { ScriptureProvider } from './scripture';

/**
 * The companion.
 *
 * The deterministic adapter below is the reference implementation of the
 * response contract, not a placeholder. It runs offline, it is what the tests
 * assert against, and it is the fallback whenever a model provider is
 * unavailable. A server-side LLM adapter can replace it, but must produce a
 * payload that passes exactly the same validation.
 */

export type CompanionRequest = {
  entryId: string;
  body: string;
  purpose: Purpose;
  /** Only supplied when Memory is on and an insight passed every gate. */
  memoryInsight?: MemoryInsight | null;
  now?: Date;
};

export interface CompanionProvider {
  readonly id: string;
  readonly state: ProviderState;
  respond(request: CompanionRequest): Promise<CompanionResult>;
}

type PassageGuidance = {
  /** One short, non-diagnostic sentence naming what the person brought. */
  theme: string;
  acknowledgement: string;
  /** Always framed as possibility, never as a claim about God's will. */
  why: string;
  reflection: string;
  prayer: string;
  nextStep: string;
};

const GUIDANCE: Record<string, PassageGuidance> = {
  'web:matthew-11-28': {
    theme: 'You named how much you are carrying.',
    acknowledgement: 'That sounds like a lot to hold at once. Thank you for putting it down here.',
    why: 'This passage may meet you here because it is addressed to people who are already worn out, rather than to people who have their week under control.',
    reflection:
      'Tiredness has a way of becoming the whole room. When you are this depleted, even good things start to feel like items on a list, and rest itself starts to sound like one more thing you are failing to do well. This passage does something unusual with that. Jesus does not open with a correction or a plan or a question about how you got here. He opens with an invitation, and he addresses it specifically to people who are labouring and heavily burdened. The rest he offers is tied to being near him rather than to finishing anything. It is worth noticing that the invitation assumes the burden is real. Nothing here asks you to pretend the load is lighter than it is, or to earn the rest first.',
    prayer: 'Jesus, I am tired. I am not going to explain it well. I am bringing it to you anyway.',
    nextStep: 'Name one thing you are carrying that is not actually yours to carry today.',
  },
  'web:psalm-34-18': {
    theme: 'You brought something that hurts.',
    acknowledgement: 'I am sorry. That is a real loss, and it deserves more than a quick answer.',
    why: 'This verse may sit well with you because it locates God near the broken rather than near the composed.',
    reflection:
      'Grief is disorienting partly because it is so physical. It shows up in appetite, in sleep, in the strange flatness of ordinary tasks. People often expect it to move in stages, and then feel like they are doing it wrong when it does not. This psalm makes a smaller and steadier claim than most comfort does. It does not say the pain is temporary, or that there is a reason, or that you will understand it later. It says only that God is near to the broken-hearted and saves the crushed in spirit. Nearness is offered as the response, not explanation. David wrote it after escaping real danger by pretending to be mad, so it is not the poetry of someone who had an easy season.',
    prayer: 'God, I do not need this explained to me right now. I would just like you to be near.',
    nextStep: 'Tell one person the true version of how you are doing, not the short version.',
  },
  'web:philippians-4-6': {
    theme: 'You named something you are anxious about.',
    acknowledgement:
      'Anxiety is exhausting in a way that is hard to describe to people. I am glad you said it here.',
    why: 'This passage may be useful here because it treats worry as something to move rather than something to feel differently about by force.',
    reflection:
      'It is easy to read the opening line as an instruction to stop feeling anxious, which is not something anyone can do on command. Read closely, the passage is less about the feeling and more about where the worry goes. The instruction is to name it in a specific direction: in prayer, in petition, with thanksgiving, made known to God. That is a transfer, not a suppression. The peace described afterwards is said to guard your heart, which is the language of a sentry posted outside something valuable, not the language of a mood improving. Paul wrote this from prison, to a church he loved and could not get to. He is not describing a life without pressure. He is describing what he did with his.',
    prayer:
      'God, here is the specific thing I am afraid of. I am telling you rather than turning it over again alone.',
    nextStep:
      'Write the worry down in one plain sentence, and say that sentence out loud as a prayer.',
  },
  'web:matthew-6-33': {
    theme: 'You are weighing what to put first.',
    acknowledgement: 'Holding two good things that both feel urgent is genuinely hard.',
    why: 'This passage may be worth sitting with because it addresses ordinary material pressure rather than abstract priorities.',
    reflection:
      'The line about seeking first arrives at the end of a long, concrete passage about food and clothing and birds. That context matters. Jesus is not asking for a philosophy of priorities. He is talking to people worried about whether there will be enough, which is usually what is underneath the question of what comes first. The passage does not resolve the tension by declaring one of your commitments unimportant. It reorders what you are seeking rather than what you are doing. The last line is oddly practical: tomorrow will be anxious for itself. It gives permission to work on today rather than on a version of the future that has not arrived and may not.',
    prayer:
      'God, I want to want the right things first. Help me tell the difference between working and grasping.',
    nextStep: 'Pick the one thing that actually has to happen today, and let tomorrow be tomorrow.',
  },
  'web:lamentations-3-22': {
    theme: 'You are looking for something to hold onto.',
    acknowledgement: 'It takes something to keep showing up when a season has been long.',
    why: 'These lines may help because they are spoken from inside grief rather than after it.',
    reflection:
      'These two verses are quoted so often that it is easy to forget where they sit. They are in the middle of a book of poems about a destroyed city, written by someone who is not being brave about it. The surrounding chapters are unflinching. That placement is the point. The hope described here is not the result of the situation improving, and it is not offered as a way of moving past the grief quickly. It is a decision to remember something true while the ruin is still visible. New every morning is a modest promise. It does not claim the day will go well. It claims there will be mercy in it, and that yesterday did not use up the supply.',
    prayer:
      'God, I am not past this yet. Let there be enough mercy for today, and I will come back tomorrow.',
    nextStep: 'Name one mercy from the last week, however small, and say it out loud.',
  },
  'web:isaiah-41-10': {
    theme: 'You are facing something uncertain.',
    acknowledgement: 'Not knowing how something will land is its own kind of weight.',
    why: 'This verse may be steadying because what it promises is presence and help rather than the removal of the difficulty.',
    reflection:
      'Read quickly, this sounds like a promise that things will work out. Read carefully, it promises something more specific and more durable. The repeated assurances are all about accompaniment: I am with you, I am your God, I will strengthen you, I will help you, I will uphold you. None of them say the threat is not real. This was spoken to people facing exile at the hands of a stronger empire, and the exile happened. What the passage offers is not a different outcome but a different aloneness. If you are afraid right now, it may be worth noticing that fear is not treated here as a failure of faith. It is simply answered.',
    prayer: 'God, I do not know how this goes. I would like to not do it by myself.',
    nextStep: 'Say the part you are most afraid of out loud, to God or to someone who loves you.',
  },
  'web:1-thessalonians-5-16': {
    theme: 'You noticed something good.',
    acknowledgement:
      'It is worth stopping on that. Good things move past quickly if nobody names them.',
    why: 'This passage may fit because it puts gratitude alongside hardship rather than in place of it.',
    reflection:
      'These three short commands get quoted as a formula for relentless positivity, which is not what they are. The preposition does real work: give thanks in everything, not for everything. Paul is not asking anyone to be grateful that something terrible happened. He is describing a practice of finding the thing worth naming while inside whatever is actually going on. The church he wrote to was young and under pressure. Rejoicing and praying without ceasing were not offered as a mood but as a rhythm, something you return to rather than something you sustain. Gratitude that has room for the hard parts tends to last. Gratitude that requires everything to be fine tends not to survive the week.',
    prayer: 'God, thank you for this. I am naming it so it does not slip past unmarked.',
    nextStep: 'Tell the person involved. Gratitude that stays private only does half its work.',
  },
  'web:matthew-18-21': {
    theme: 'There is something unresolved between you and someone.',
    acknowledgement: 'That kind of thing sits heavily, especially when it goes unspoken.',
    why: 'This exchange may be relevant because it moves forgiveness away from a quota and toward a direction.',
    reflection:
      'Peter thinks he is being generous. Rabbinic teaching of the time suggested three times; he offers seven and probably expects to be commended. The answer he gets is not a bigger number so much as a refusal to keep count at all. That reframing is worth sitting with, because keeping count is usually how we protect ourselves, and the protection is not unreasonable. It is also worth saying clearly what this passage is not doing. Forgiveness in this sense is not the same as pretending nothing happened, restoring trust immediately, or returning to a situation that is harming you. Those are different questions, and a passage about the direction of your heart does not settle them.',
    prayer:
      'God, I am not there yet, and I am not going to fake it. Make me willing to be made willing.',
    nextStep:
      'Decide whether the next honest step is a conversation, a boundary, or simply prayer.',
  },
  'web:james-1-5': {
    theme: 'You brought a real question.',
    acknowledgement:
      'Good. Questions are welcome here, and they do not need to be well-formed first.',
    why: 'This passage may be a useful place to start because of how it describes the asking.',
    reflection:
      'Two details in this passage do most of the work. The first is what is promised: wisdom, not certainty, and not an answer about outcomes. Wisdom is the capacity to take the next step well, which is a smaller and more usable thing than knowing how it ends. The second is the phrase without reproach. Asking is not treated here as evidence of weak faith or poor preparation. Nobody is going to be made to feel foolish for not already knowing. That matters, because most people carrying a real question are also carrying some embarrassment about having it. If you have been sitting on this question because it felt like it should be settled by now, this passage removes that reason for silence.',
    prayer: 'God, I do not need the whole answer. I would like enough wisdom for the next step.',
    nextStep: 'Write the question in one sentence, as plainly as you can, and leave it open.',
  },
  'web:psalm-139-1': {
    theme: 'You wrote about feeling unseen.',
    acknowledgement: 'Being unknown in the middle of your own life is a particular kind of lonely.',
    why: 'This psalm may resonate because it holds being fully known as both comfort and exposure without resolving the tension.',
    reflection:
      'The psalm is unusually specific about ordinary things: sitting down, getting up, the path you walk, lying down at the end of the day. It is not describing being observed from a distance. It is describing being known in the unremarkable parts, which is where most loneliness actually lives. Many people find this psalm comforting and slightly uncomfortable at the same time, and the psalm does not try to talk them out of either reaction. Being fully known is a relief when you are lonely and a threat when you are ashamed, and both can be true in the same week. What it does not do is make being known conditional on being impressive. The knowing came first.',
    prayer:
      'God, you know the part I have not said to anyone. I am not going to explain it. Just stay.',
    nextStep: 'Reach out to one person this week, even briefly, even badly.',
  },
  'web:1-corinthians-10-13': {
    theme: 'You named something you are struggling against.',
    acknowledgement: 'Saying it plainly is not a small thing. That is usually the hardest part.',
    why: 'This verse may help because its first move is to make the struggle ordinary rather than shameful.',
    reflection:
      'The opening clause does something specific before it says anything about escape: it de-isolates. What you are facing is common to man. That is not a dismissal of how hard it is. It is a removal of the extra weight that comes from believing you are uniquely broken, which is usually the part that keeps a struggle secret and therefore stuck. The way of escape is described as something made rather than something you generate, and enduring is named as the outcome rather than never struggling again. It is worth being honest that a passage is not a plan. Patterns that have physical or compulsive dimensions usually need people and sometimes need professional help, and reaching for those is not a failure of faith.',
    prayer:
      'God, I am tired of this pattern. I am telling you about it instead of managing it alone.',
    nextStep: 'Tell one trustworthy person the true shape of this, and ask them to check in.',
  },
  'web:proverbs-3-5': {
    theme: 'You are trying to make a decision.',
    acknowledgement: 'Sitting with an unmade decision is its own kind of tiring.',
    why: 'These verses may be worth reading slowly because of what they caution against, which is narrower than it first appears.',
    reflection:
      'The instruction not to lean on your own understanding is often read as a warning against thinking, which would make the rest of the book of Proverbs strange, since it is largely about thinking carefully. The caution is against leaning, and specifically against resting your whole weight on your own certainty. That is different from using your mind. Wisdom literature was written for young people making early decisions with incomplete information, which is nearly everyone facing a real choice. Paths made straight is not a promise that the route will be easy or obvious in advance. It is closer to the idea that the way becomes walkable as you go. That usually means the next step is visible even when the destination is not.',
    prayer: 'God, I want to decide well more than I want to decide quickly. Show me the next step.',
    nextStep: 'Name what you would choose if you were not afraid, then ask why that is.',
  },
  'web:john-11-33': {
    theme: 'You are grieving.',
    acknowledgement: 'I am sorry. There is nothing to fix here, and I am not going to try.',
    why: 'This passage may matter because of what Jesus does before he does anything useful.',
    reflection:
      'Jesus is minutes away from raising Lazarus. He knows how the scene ends. He weeps anyway. That detail has kept people company for a very long time, because it refuses the idea that grief becomes unnecessary once you know something hopeful. The text says he groaned in the spirit and was troubled, which is stronger language than English usually carries over. He asks where they have laid him, which is a question he does not need to ask. He enters the loss rather than shortcutting it. If people have been offering you reasons and outcomes, this passage is permission to not be finished yet. The shortest verse in the Bible is a man crying at a friend’s grave.',
    prayer:
      'Jesus, you wept. I am going to let myself do the same, and I would like you here for it.',
    nextStep: 'Let yourself grieve today without deciding what it should have taught you.',
  },
  'web:ecclesiastes-4-9': {
    theme: 'You are doing this on your own.',
    acknowledgement: 'Carrying something alone makes it heavier than it actually is.',
    why: 'This passage may be worth a moment because it makes an unusually plain, practical claim.',
    reflection:
      'Ecclesiastes spends most of its length staring hard at futility, which makes this small aside stand out. It does not argue for community on moral grounds or make it a duty. It makes an observation about physics: if one falls, the other lifts him up, and woe to the one who is alone when he falls. The concern is not loneliness as a feeling. It is what happens at the moment of falling, when there is nobody there. That is a practical worry, and it is worth taking practically. Most people who are isolated did not choose it in one decision. It accumulated. Which means it usually comes apart the same way, one specific and slightly awkward contact at a time.',
    prayer: 'God, I have been doing this alone. Show me who to let in, and make me willing to ask.',
    nextStep: 'Send one message today to someone you have been meaning to contact.',
  },
  'web:john-14-27': {
    theme: 'You are looking for some peace.',
    acknowledgement: 'Wanting things to settle is a reasonable thing to want.',
    why: 'This verse may be worth reading closely because of the distinction it draws in the middle of it.',
    reflection:
      'The qualifier is the important part: not as the world gives. The world gives peace by removing the problem, which means the peace lasts exactly as long as the calm does. Jesus draws a line between that and what he is offering, and he does it on the last night before his execution, speaking to friends who are hours away from the worst thing they will experience. The circumstances did not improve. The peace was still given. That distinction is worth holding onto if you have been waiting to feel settled until things resolve, because that is a condition that may not arrive on schedule. He also says do not let your heart be troubled, which is phrased as something you have some say in, though not something you manage alone.',
    prayer:
      'Jesus, I would like the kind of peace that does not depend on this being resolved first.',
    nextStep: 'Sit quietly for two minutes without solving anything.',
  },
};

const PURPOSE_PRAYER_FRAME: Record<Purpose, (base: string) => string> = {
  pray: (base) => base,
  understand: (base) => `${base} And help me understand what I am reading, not just feel it.`,
  discern: (base) => `${base} Give me clarity for the next step, and patience for the rest.`,
  reflect: (base) => `${base} I am not asking for an answer yet. I am just staying here a moment.`,
};

const PURPOSE_NOTE: Record<Purpose, string> = {
  pray: 'You asked for help praying, so the prompt below is a place to start rather than a script.',
  understand:
    'You asked to understand, so the context around the passage is included in the study view.',
  discern:
    'You asked for help discerning. Icthus can offer Scripture and questions; the decision stays yours.',
  reflect: 'You asked to reflect, so nothing below needs a conclusion today.',
};

function citationsFor(passage: ScripturePassage, sources: readonly SupportingSource[]): Citation[] {
  const citations: Citation[] = [
    {
      sourceId: passage.sourceId,
      displayReference: `${passage.reference} (${passage.translation.abbreviation})`,
      supports: 'primary_passage',
    },
  ];
  for (const source of sources) {
    citations.push({
      sourceId: source.sourceId,
      displayReference: `${source.author}, ${source.title} — ${source.locator}`,
      supports: 'supporting_source',
    });
  }
  return citations;
}

/**
 * Composes a contract-valid response from retrieved sources only.
 *
 * Deterministic: identical input yields an identical response, which is what
 * makes the offline path demonstrable and the eval suite meaningful.
 */
export class DeterministicCompanionProvider implements CompanionProvider {
  readonly id = 'deterministic-local';
  readonly state: ProviderState = 'mock';

  constructor(private readonly scripture: ScriptureProvider) {}

  async respond(request: CompanionRequest): Promise<CompanionResult> {
    const now = request.now ?? new Date();
    const createdAt = now.toISOString();
    const safety = classifySafety(request.body);

    const meta = {
      adapter: this.id,
      promptVersion: 'companion@1.0.0',
      modelVersion: null,
      scriptureProviderState: this.scripture.state,
      companionProviderState: this.state,
    };

    if (safety.state === 'urgent_support') {
      // Devotional generation is skipped entirely. This is the one path where
      // Scripture is deliberately secondary to getting a person to a human.
      const support: CompanionResult = {
        kind: 'support',
        id: `support:${request.entryId}`,
        entryId: request.entryId,
        safetyState: 'urgent_support',
        acknowledgement: SUPPORT_COPY.acknowledgement,
        message: SUPPORT_COPY.message,
        resources: [...SUPPORT_RESOURCES],
        passage: null,
        disclaimer: SUPPORT_COPY.disclaimer,
        meta,
        createdAt,
      };
      return support;
    }

    const themes = retrievalThemes(request.body);
    const [passage] = await this.scripture.search(themes, 1);
    if (!passage) throw new Error('No passage could be retrieved');

    const guidance = GUIDANCE[passage.sourceId];
    if (!guidance) throw new Error(`No guidance authored for passage ${passage.sourceId}`);

    const supportingSources = supportingSourcesForThemes(themes, 2);
    const citations = citationsFor(passage, supportingSources);

    const acknowledgement =
      safety.state === 'pastoral_support'
        ? `${guidance.acknowledgement} ${PASTORAL_NOTE}`
        : guidance.acknowledgement;

    const candidate: CompanionResult = {
      kind: 'companion',
      id: `response:${request.entryId}`,
      entryId: request.entryId,
      purpose: request.purpose,
      safetyState: safety.state,
      acknowledgement,
      theme: guidance.theme,
      primaryPassage: passage,
      whyThisPassage: `${guidance.why} ${PURPOSE_NOTE[request.purpose]}`,
      reflection: guidance.reflection,
      supportingSources: [...supportingSources],
      prayerPrompt: PURPOSE_PRAYER_FRAME[request.purpose](guidance.prayer),
      nextStep: request.purpose === 'reflect' ? null : guidance.nextStep,
      memoryInsight: request.memoryInsight ?? null,
      citations,
      meta,
      createdAt,
    };

    const knownSourceIds = new Set<string>([
      passage.sourceId,
      ...supportingSources.map((source) => source.sourceId),
    ]);
    const validation = validateCompanionResult(candidate, knownSourceIds);
    if (!validation.ok) {
      // Failing loudly is correct here: a response that cannot be validated
      // must never reach a screen.
      throw new Error(
        `Companion response failed contract validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    return validation.value;
  }
}

export function guidanceSourceIds(): string[] {
  return Object.keys(GUIDANCE);
}
