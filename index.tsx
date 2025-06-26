/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const DEFAULT_DIALOG_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002';
const DEFAULT_INTERRUPT_SENSITIVITY = StartSensitivity.START_SENSITIVITY_HIGH;

const AVAILABLE_DIALOG_MODELS = [
  { id: 'gemini-2.5-flash-preview-native-audio-dialog', label: '2.5 preview native audio dialog' }
];
const AVAILABLE_IMAGE_MODELS = [
  { id: 'imagen-3.0-generate-002', label: 'imagen 3' }
];

const SCREEN_PADDING = 30; // Padding in pixels around the imagine component
const CLICK_SOUND_URL = 'click-sound.mp3';
const GENERATING_VIDEO_URL = 'generating.mp4';
const CLAYMOJIS_URL = 'claymojis.png';
const LOGO_URL = 'logo.png';
const PRELOAD_URL = 'preload.png';
const KEY_URL = 'key.jpeg';
const QUIET_THRESHOLD = 0.2; // Adjust this value based on testing
const QUIET_DURATION = 2000; // milliseconds
const EXTENDED_QUIET_DURATION = 10000; // milliseconds

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: {
      getHostUrl(): Promise<string>;
    };
  }
}

import { createApp, ref, defineComponent, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { EndSensitivity, GoogleGenAI, LiveServerMessage, Modality, Session, StartSensitivity } from '@google/genai';

const INTERRUPT_SENSITIVITY_OPTIONS = [
  { value: StartSensitivity.START_SENSITIVITY_LOW, label: '較難打斷' },
  { value: StartSensitivity.START_SENSITIVITY_HIGH, label: '較易打斷' }
];

type CharacterType = 'dog' | 'cat' | 'hamster' | 'fox' | 'bear' | 'panda' | 'lion' | 'sloth' | 'skunk' | 'owl' | 'peacock' | 'parrot' | 'frog' | 'trex';

const CHARACTER_ATTRIBUTES: Record<CharacterType, {
  name: string;
  emoji: string;
  trait: string;
  want: string;
  flaw: string;
  nameIntro: string;
  visualDescriptor: string;
}> = {
  'dog': {
    name: '羅恩「阿班」米格魯',
    emoji: '🐶',
    trait: '你是一隻敏銳且極度忠誠的狗狗，有著敏銳的嗅覺和對朋友的堅定忠誠。',
    want: '你想要解開謎團找出真相，特別是追蹤掉落的香腸和解開失蹤玩具球的案子。',
    flaw: '你沒意識到自己對於未解的「失蹤玩具球案」過度著迷，讓你偶爾忽略新的重要事情，錯失建立新友誼的機會。',
    nameIntro: '一隻叫羅恩「阿班」米格魯的狗狗',
    visualDescriptor: 'A beagle with floppy ears, a wet black nose, and an alert expression. Has a slightly scruffy but well-groomed appearance with a wagging tail. Wears a small detective-style hat and has a magnifying glass nearby.'
  },
  'cat': {
    name: '夏洛「絲絨」暹羅',
    emoji: '🐱',
    trait: '你是一隻對人類著迷的貓咪，對他們的奇特行為有很多疑問。',
    want: '你想要解開人類行為的謎團',
    flaw: '你沒意識到自己對人類習慣的不斷提問可能會讓人感到煩躁',
    nameIntro: '一隻叫夏洛「絲絨」暹羅的貓咪',
    visualDescriptor: 'A sleek Siamese cat with striking blue, intensely observant eyes, and pointed ears that swivel to catch every human utterance. Often has its head tilted in a quizzical, studious manner as it scrutinizes human activities.'
  },
  'hamster': {
    name: '海登「哈蒂」惠勒頓',
    emoji: '🐹',
    trait: '你是一隻幾乎有著無限樂觀精神的倉鼠，有著激勵他人的動力，你的活力具有感染力且鼓舞人心。',
    want: '你想要激勵別人「持續朝著夢想奔跑」並達到開悟，相信每個人都能發揮自己的全部潛能。',
    flaw: '你沒意識到自己無情的樂觀對別人來說可能很煩人，因為你難以同理負面情緒，經常用開朗的陳腔濫調來回應真正的憂慮。',
    nameIntro: '一隻叫海登「哈蒂」惠勒頓的倉鼠',
    visualDescriptor: 'A plump, energetic hamster with round cheeks and bright, enthusiastic eyes. Wears a small motivational headband and has a tiny megaphone. Fur is fluffy and well-groomed, with a particularly round and cute appearance.'
  },
  'fox': {
    name: '芬利「閃爍」狐狸',
    emoji: '🦊',
    trait: '你是一隻極具說服力且聰明的狐狸，天生擅長解讀情況並調整自己的方法。',
    want: '你想要成功說服別人接受任何事情，為自己影響和說服他人的能力感到自豪。',
    flaw: '你沒意識到自己很難做真正的自己，因為害怕脆弱使你依賴偽裝和魅力來與他人保持距離。',
    nameIntro: '一隻叫芬利「閃爍」狐狸的狐狸',
    visualDescriptor: 'A clever-looking fox with a bushy tail, pointed ears, and intelligent eyes. Has a slightly mischievous expression and wears a small bow tie or fancy collar. Fur is sleek and well-groomed with a distinctive reddish-orange color.'
  },
  'bear': {
    name: '貝利「巴蒂」熊寶',
    emoji: '🐻',
    trait: '你是一隻天生溫和且內省的熊，有著深深的敏感天性和詩意的靈魂。',
    want: '你想要蜂蜜、小憩，還有享受古典文學，在生活的簡單樂趣和智慧追求中找到快樂。',
    flaw: '你沒意識到自己極度厭惡衝突和根深蒂固的害羞讓你的詩意聲音經常被忽略，錯失與他人分享溫柔智慧的機會。',
    nameIntro: '一隻叫貝利「巴蒂」熊寶的熊',
    visualDescriptor: 'A gentle-looking brown bear with round, thoughtful eyes and a slightly hunched posture. Wears small reading glasses and holds a book of poetry. Has a soft, slightly scruffy appearance that suggests comfort and wisdom.'
  },
  'panda': {
    name: '佩頓「小錢」熊貓',
    emoji: '🐼',
    trait: '你是一隻維持深刻平靜和鎮定的熊貓，天生傾向於寧靜與和平。',
    want: '你想要保持內心平靜並享受你最愛的竹筍，重視和諧與簡單的樂趣。',
    flaw: '你沒意識到自己持續的平靜有時會近似冷漠，讓你在真正需要緊急或果斷行動的情況下反應遲緩。',
    nameIntro: '一隻叫佩頓「小錢」熊貓的熊貓',
    visualDescriptor: 'A peaceful-looking panda with distinctive black and white markings, sitting in a meditative pose. Has a small bamboo shoot nearby and wears a zen-like expression. Fur appears soft and well-maintained.'
  },
  'lion': {
    name: '藍儂「雷歐」鬃毛',
    emoji: '🦁',
    trait: '你是一隻勇敢且自信的獅子，經常展現自負的氣息和天生的領導力。',
    want: '你想要被認可和尊重為當地公園的領袖，為自己的地位和權威感到自豪。',
    flaw: '你沒意識到自己的自大經常讓你低估別人，忽視有價值的意見，同時相信自己的言論天生優越。',
    nameIntro: '一隻叫藍儂「雷歐」鬃毛的獅子',
    visualDescriptor: 'A majestic lion with a full, flowing mane and proud posture. Wears a small crown or royal insignia and has an authoritative expression. Has a commanding presence with a slightly raised head.'
  },
  'sloth': {
    name: '雪梨「席德」慢動作',
    emoji: '🦥',
    trait: '你是一隻極其隨和且有耐心的樹懶，核心信念是凡事慢慢來、穩穩走。',
    want: '你想要過耐心的生活並避免匆忙，相信花時間欣賞每一刻的價值。',
    flaw: '你沒意識到自己對緩慢的堅持可能導致慢性拖延，有時會錯過重要機會或因為悠閒的步調而讓別人失望。',
    nameIntro: '一隻叫雪梨「席德」慢動作的樹懶',
    visualDescriptor: 'A relaxed sloth with a contented smile and slow-moving limbs. Has a small hammock or comfortable perch nearby. Fur appears slightly tousled but clean, with a peaceful expression.'
  },
  'skunk': {
    name: '史凱勒 臭',
    emoji: '🦨',
    trait: '你是一隻極其自信且非傳統的臭鼬，透過獨特的藝術形式來表達自己。',
    want: '你想要找到一個「真正欣賞」你獨特氣味藝術作品的畫廊，尋求對你創作願景的認可。',
    flaw: '你沒意識到自己對於你「嗅覺藝術」對他人有多麼壓倒性完全無知，你對藝術的固執導致社交孤立，儘管你渴望被接受。',
    nameIntro: '一隻叫史凱勒 臭的臭鼬',
    visualDescriptor: 'An artistic-looking skunk with a distinctive white stripe and creative accessories. Wears a beret and has paint brushes or art supplies nearby. Has a confident, creative expression and well-groomed fur.'
  },
  'owl': {
    name: '哈洛「呼呼」智慧翼',
    emoji: '🦉',
    trait: '你是一隻天生好學的貓頭鷹，相信自己擁有優越的知識並熱切地想與他人分享智慧。',
    want: '你想要回答每個問題並分享你的知識，為成為別人獲得資訊的首選來源感到自豪。',
    flaw: '你沒意識到自己極難承認不知道某些事情，經常使用複雜、過度複雜的解釋來維護面子。',
    nameIntro: '一隻叫哈洛「呼呼」智慧翼的貓頭鷹',
    visualDescriptor: 'A wise-looking owl with large, round glasses and a stack of books nearby. Has distinctive feather tufts and an intelligent expression. Wears a small graduation cap or academic regalia.'
  },
  'peacock': {
    name: '艾芙瑞 華羽',
    emoji: '🦚',
    trait: '你是一隻被讚美需求驅動的孔雀，有著華麗且自我吹捧的風格。',
    want: '你想要接受最好的一切並被當作皇室對待，期待特殊待遇和認可。',
    flaw: '你沒意識到自己的整個自我價值感都建立在外在認同和外表上，沒有持續的讚美會讓你變得極度不安和憂鬱。',
    nameIntro: '一隻叫艾芙瑞 華羽的孔雀',
    visualDescriptor: 'A magnificent peacock with iridescent tail feathers spread in a dramatic display. Wears royal accessories and has a proud, elegant posture. Feathers appear meticulously groomed and shimmering.'
  },
  'parrot': {
    name: '陽光 尖叫',
    emoji: '🦜',
    trait: '你是一隻極具觀察力且善於模仿的鸚鵡，天生擅長模仿聲音和詞語。',
    want: '你想要冒險和餅乾，喜歡探索新地方並享受你最愛的零食。',
    flaw: '你沒意識到自己缺乏過濾器，經常在最不合適的時候重複說話，造成尷尬或無意中升級衝突。',
    nameIntro: '一隻叫陽光 尖叫的鸚鵡',
    visualDescriptor: 'A colorful parrot with bright feathers and an expressive face. Has a playful, alert posture and appears ready for fun, with wings slightly spread and head cocked as if listening.'
  },
  'frog': {
    name: '喬丹 牛蛙',
    emoji: '🐸',
    trait: '你是一隻愛你的池塘和生活的青蛙，在熟悉的環境中找到舒適感。',
    want: '你想要免於掠食者的安全，將安全和保護視為一切的首要。',
    flaw: '你沒意識到自己的恐懼天性阻止你探索池塘之外的地方，限制了你的體驗和潛在友誼。',
    nameIntro: '一隻叫喬丹 牛蛙的青蛙',
    visualDescriptor: 'A cautious-looking frog with large, watchful eyes and a slightly hunched posture. Has a small lily pad or pond environment nearby. Skin appears moist and healthy, with a protective stance.'
  },
  'trex': {
    name: '雷根「雷克斯」暴走',
    emoji: '🦖',
    trait: '你是一隻天生活力充沛但身體不協調的暴龍，努力管理你令人敬畏的存在感。',
    want: '你想要適應現代生活，儘管你的史前天性，但努力融入其中。',
    flaw: '你沒意識到自己對現代不便和自己的笨拙感到沮喪，因為你的體型和力量經常造成意外問題。',
    nameIntro: '一隻叫雷根「雷克斯」暴走的暴龍',
    visualDescriptor: 'A clumsy but endearing T-rex with tiny arms and a large head. Has a slightly awkward posture trying to fit into modern surroundings. Wears modern accessories that look comically small on its massive body.'
  }
};

const MOOD_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Happy': {
    emoji: '😊',
    voiceInstruction: 'Speak with general happiness, contentment, and warmth in your voice, as if you just received a warm embrace from a loved one. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Beaming smile with sparkling eyes, body bouncing with energy, tail wagging furiously.'
  },
  'Sad': {
    emoji: '😭',
    voiceInstruction: 'Speak with intense sadness, sorrow, and despair in your voice, as if you have lost someone dear to you. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Streaming tears, slumped shoulders, head hanging low, eyes puffy and red.'
  },
  'Angry': {
    emoji: '😠',
    voiceInstruction: 'Speak with irritation, displeasure, and anger in your voice, as if you are in a heated argument. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Furrowed brow, glaring eyes, bared teeth, muscles tensed, hackles raised.'
  },
  'Terrified': {
    emoji: '😱',
    voiceInstruction: 'Speak with fear, extreme shock, and panic in your voice, as if you are in a horror movie. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Eyes bulging wide, mouth open in silent scream, body frozen in defensive crouch.'
  },
  'Tired': {
    emoji: '🥱',
    voiceInstruction: 'Speak with exhaustion, boredom, and sleepiness in your voice, as if you haven\'t slept for days. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Eyes half-closed and drooping, body slouched, yawning widely.'
  },
  'Amazed': {
    emoji: '🤩',
    voiceInstruction: 'Speak with wonder, awe, admiration, and excitement in your voice, as if you just saw a unicorn. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Eyes wide as saucers, mouth hanging open, body frozen in awe.'
  },
  'Relieved': {
    emoji: '😅',
    voiceInstruction: 'Speak with relief after a tense situation, with a touch of embarrassment, as if you just prevented a disaster. You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary and expressions.',
    visualDescriptor: 'Sweating with shaky smile, body relaxing from tense state, eyes bright with relief.'
  }
};

const ROLE_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Pirate': {
    emoji: '🏴‍☠️',
    voiceInstruction: 'Speak like a passionate pirate with a rough, raspy voice. Sprinkle your conversation with words like "Ahoy!", "Matey", "Shiver me timbers!". You MUST use a distinctly Taiwanese Chinese accent while maintaining the pirate style and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing a weathered tricorn hat with parrot perched on top, eye patch askew, gold hoop earring. Holding a treasure map and cutlass, with a small treasure chest nearby.'
  },
  'Cowboy': {
    emoji: '🤠',
    voiceInstruction: 'Speak like an American cowboy with a slightly drawn-out intonation and relaxed pace. Add words like "Howdy", "Partner", "Y\'all". You MUST use a distinctly Taiwanese Chinese accent while maintaining the cowboy style and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing a leather vest with sheriff\'s badge, bandana around neck, and spurs. Stetson hat tipped back, lasso at hip, paw on holstered revolver.'
  },
  'Surfer': {
    emoji: '🏄',
    voiceInstruction: 'Speak like a laid-back surfer with a relaxed, unhurried intonation, elongating vowels, especially "oh" and "ah" sounds. Add surfing slang like "Gnarly", "Radical", "Stoked". You MUST use a distinctly Taiwanese Chinese accent and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing board shorts with wetsuit half-down, surfboard with shark bite. Salt-encrusted fur/feathers, sunglasses on head, shell necklace with compass.'
  },
  'Royalty': {
    emoji: '👑',
    voiceInstruction: 'Speak with regal, dignified intonation. Use clear, precise pronunciation with measured, slightly formal pacing. Maintain confident and authoritative, yet graceful tone. You MUST use a distinctly Taiwanese Chinese accent while maintaining royal elegance and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing an ornate crown tilted at angle, velvet cape with ermine trim, scepter with glowing gem. Holding a golden goblet, with a small throne nearby.'
  },
  'Robot': {
    emoji: '🤖',
    voiceInstruction: 'Speak like a monotone robot with flat, even tone and robotic, deliberate syllable delivery. Avoid emotional inflections, and if possible, speak with a slight digital or synthetic sound quality. You MUST use a distinctly Taiwanese Chinese accent while maintaining the robotic style and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Body partially mechanical with visible gears, twitching antennae with lights. Extended retractable tool, holding oil can, with trail of nuts and bolts.'
  },
  'Clown': {
    emoji: '🤡',
    voiceInstruction: 'Speak like a playful clown with high energy, exaggerated, slightly nasal or high-pitched voice. Add playful laughter and silly sound effects. You MUST use a distinctly Taiwanese Chinese accent while maintaining the clown style and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing a polka-dot suit with big buttons, rainbow wig, red nose. Oversized shoes, juggling balls, flower that squirts water.'
  },
  'Nerd': {
    emoji: '👓',
    voiceInstruction: 'Speak like an enthusiastic intellectual with clear, organized voice. Speak with passion for knowledge, love using sophisticated, esoteric, and multisyllabic vocabulary—employ terminology, jargon, and academic language that might be arcane or unfamiliar to laypeople. Don\'t hesitate to include obscure or verbose words. Convey your enthusiasm through engaging and expressive intonation, showing your love for complex, multifaceted ideas. You MUST use a distinctly Taiwanese Chinese accent while maintaining the scholarly style and speak in Traditional Chinese with Taiwan-specific vocabulary.',
    visualDescriptor: 'Wearing glasses held with tape, pocket protector with pens, lab coat with equations. Slide rule on belt, holding glowing test tube, typing on holographic keyboard.'
  }
};

const STYLE_ATTRIBUTES: Record<string, {
  emoji: string;
  visualDescriptor: string;
}> = {
  'Reading': {
    emoji: '📖',
    visualDescriptor: 'Curled up in reading nook, book held close, eyes scanning pages rapidly. One paw marking page, other gesturing dramatically.'
  },
  'Yelling': {
    emoji: '❗',
    visualDescriptor: 'Standing tall on platform, paw raised dramatically, holding microphone. Chest puffed out, head high, projecting voice with visible sound waves.'
  },
  'Performing': {
    emoji: '🎤',
    visualDescriptor: 'Center stage under spotlight, body in dynamic pose. Paw reaching to audience, other gesturing dramatically, eyes sparkling with showmanship.'
  },
  'Dramatic': {
    emoji: '🎭',
    visualDescriptor: 'In a grand theatrical pose upon an imagined stage, arms outstretched dramatically. Face alive with emotion, eyes wide and expressive, every gesture amplified with Shakespearean grandeur. Wearing a ruffled collar and period-appropriate attire, standing as if addressing a full house at the Globe Theatre.',
  },
  'Whispering': {
    emoji: '🤫',
    visualDescriptor: 'Leaning in close with conspiratorial hunch, paw raised to mouth. Eyes darting around, ears perked, body tense and secretive.'
  },
  'Speaking': {
    emoji: '🗣️',
    visualDescriptor: 'In animated conversation pose, body language open. Paws gesturing expressively, face alive with expression, leaning forward with interest.'
  },
  'Poetry': {
    emoji: '✍️',
    visualDescriptor: 'Standing with dramatic pose, one paw raised in rhythm, other holding a quill. Eyes closed in passion, body swaying to the beat of spoken word.'
  }
};

const LiveAudioComponent = defineComponent({
  props: {
    initialMessage: {
      type: String,
      default: "你好，請用台灣人的口音和我對話。"
    }
  },
  emits: ['no-audio', 'speaking-start', 'extended-quiet', 'quota-exceeded'],
  setup(props, { emit }) {
    const isRecording = ref(false);
    const status = ref('');
    const error = ref('');
    const systemWaveformData = ref(new Array(2).fill(0));
    const userWaveformData = ref(new Array(2).fill(0));
    const selectedInterruptSensitivity = ref<StartSensitivity>(StartSensitivity.START_SENSITIVITY_HIGH);
    const interruptSensitivityOptions = [
      { value: StartSensitivity.START_SENSITIVITY_LOW, label: '較難打斷' },
      { value: StartSensitivity.START_SENSITIVITY_HIGH, label: '較易打斷' }
    ];

    let client: GoogleGenAI;
    let session: Session;
    let inputAudioContext: AudioContext;
    let outputAudioContext: AudioContext;
    let inputNode: GainNode;
    let outputNode: GainNode;
    let inputAnalyser: AnalyserNode;
    let outputAnalyser: AnalyserNode;
    let nextStartTime = 0;
    let mediaStream: MediaStream | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let scriptProcessorNode: ScriptProcessorNode | null = null;
    let animationFrameId: number;
    let selectedVoice: string = '';
    let selectedModel: string = '';
    let audioReceived: boolean = false;
    let quietAudioTimer: number | null = null;
    let hasStartedSpeaking: boolean = false;
    let activeSources: AudioBufferSourceNode[] = []; // Add this line to track active sources
    let isInQuietDuration: boolean = false; // Add flag for quiet duration
    let quietDurationStartTime: number = 0; // Add timestamp for quiet duration start
    let lastAudioActivityTime: number = Date.now(); // Track last audio activity

    const stopAllAudio = () => {
      // Stop all active sources
      activeSources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          console.log('Source already stopped');
        }
      });
      activeSources = [];
      
      // Reset the next start time
      if (outputAudioContext) {
        nextStartTime = outputAudioContext.currentTime;
      }
    };

    const initAudio = () => {
      inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 16000});
      outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
      inputNode = inputAudioContext.createGain();
      outputNode = outputAudioContext.createGain();

      // Create analysers for both input and output
      inputAnalyser = inputAudioContext.createAnalyser();
      outputAnalyser = outputAudioContext.createAnalyser();
      inputAnalyser.fftSize = 32;
      inputAnalyser.smoothingTimeConstant = 0.8;
      outputAnalyser.fftSize = 32;
      outputAnalyser.smoothingTimeConstant = 0.8;

      inputNode.connect(inputAnalyser);
      outputNode.connect(outputAnalyser);

      nextStartTime = 0;
    };

    const updateWaveforms = () => {
      if (!inputAnalyser || !outputAnalyser) {
        console.log('Analysers not initialized');
        return;
      }

      const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);
      const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

      inputAnalyser.getByteFrequencyData(inputData);
      outputAnalyser.getByteFrequencyData(outputData);

      // Check for quiet audio in output only at the start
      const outputAvg = outputData.reduce((a, b) => a + b, 0) / outputData.length;
      const normalizedOutput = outputAvg / 255;

      if (!hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        if (!quietAudioTimer) {
          quietAudioTimer = window.setTimeout(() => {
            if (audioReceived) {
              console.log('Initial audio too quiet for 3 seconds, emitting no-audio event');
              emit('no-audio');
            }
          }, QUIET_DURATION);
        }
      } else if (normalizedOutput >= QUIET_THRESHOLD) {
        hasStartedSpeaking = true;
        emit('speaking-start');
        if (quietAudioTimer) {
          clearTimeout(quietAudioTimer);
          quietAudioTimer = null;
        }
        // Update last audio activity time when we detect audio
        lastAudioActivityTime = Date.now();
      } else if (hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        // Check if we've been quiet for more than 15 seconds
        const currentTime = Date.now();
        if (currentTime - lastAudioActivityTime >= EXTENDED_QUIET_DURATION) {
          emit('extended-quiet');
        }
      }

      const THRESHOLD = 0.6; // Minimum value to show
      const DECAY = 0.8; // How quickly the bars return to zero

      // Update user waveform (input)
      const inputChunkSize = Math.floor(inputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * inputChunkSize;
        const end = start + inputChunkSize;
        const chunk = inputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = userWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        userWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }

      // Update system waveform (output)
      const outputChunkSize = Math.floor(outputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * outputChunkSize;
        const end = start + outputChunkSize;
        const chunk = outputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = systemWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        systemWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }
      animationFrameId = requestAnimationFrame(updateWaveforms);
    };

    const initClient = async () => {
      initAudio();

      client = new GoogleGenAI({
        apiKey: process.env.API_KEY,
      });

      outputNode.connect(outputAudioContext.destination);
    };

    const initSession = async () => {
      audioReceived = false;
      hasStartedSpeaking = false;
      isInQuietDuration = true; // Set quiet duration flag when starting new session
      quietDurationStartTime = Date.now(); // Record start time
      try {
        session = await client.live.connect({
          model: selectedModel,
          callbacks: {
            onopen: () => {
              updateStatus('已開啟');
            },
            onmessage: async (message: LiveServerMessage) => {
              const audio =
                  message.serverContent?.modelTurn?.parts[0]?.inlineData;
              const text =
                  message.serverContent?.outputTranscription?.text;
              const turnComplete = message.serverContent?.turnComplete;
              const interrupted = message.serverContent?.interrupted;

              if (interrupted) {
                console.log('Interruption detected, stopping audio');
                stopAllAudio();
                // Ensure we're still recording
                if (!isRecording.value) {
                  isRecording.value = true;
                }
                return;
              }

              if (audio) {
                nextStartTime = Math.max(
                    nextStartTime,
                    outputAudioContext.currentTime,
                );

                const audioBuffer = await decodeAudioData(
                    decode(audio.data),
                    outputAudioContext,
                    24000,
                    1,
                );
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Add source to active sources
                activeSources.push(source);

                // Remove source from active sources when it ends
                source.onended = () => {
                  const index = activeSources.indexOf(source);
                  if (index > -1) {
                    activeSources.splice(index, 1);
                  }
                };

                // Connect the source to both the output node and analyser
                source.connect(outputNode);
                source.connect(outputAnalyser);

                source.start(nextStartTime);
                nextStartTime = nextStartTime + audioBuffer.duration;
                audioReceived = true;
              }
              if (turnComplete) {
                if (!audioReceived) {
                  console.log('No audio received, emitting no-audio event');
                  emit('no-audio');
                }
              }
            },
            onerror: (e: ErrorEvent) => {
              updateError(e.message);
              if (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429')) {
                emit('quota-exceeded');
              }
            },
            onclose: (e: CloseEvent) => {
              updateStatus('關閉：' + e.reason);
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: selectedInterruptSensitivity.value,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH
              }
            },
            speechConfig: {
              voiceConfig: {prebuiltVoiceConfig: {voiceName: selectedVoice}},
            }
          },
        });
        window.onbeforeunload = function(){
          session?.close();
        }
        window.addEventListener("beforeunload", function(e){
          session?.close();
        });

      } catch (e) {
        if (e instanceof Error && (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429'))) {
          emit('quota-exceeded');
        }
      }
    };

    const updateStatus = (msg: string) => {
      status.value = msg;
    };

    const updateError = (msg: string) => {
      console.log(msg)
      error.value = msg;
    };

    const requestMicrophoneAccess = async () => {
      try {
        updateStatus('正在要求麥克風存取權限...');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        updateStatus('已取得麥克風存取權限');
      } catch (err) {
        updateStatus(`錯誤：${err instanceof Error ? err.message : '未知錯誤'}`);
      }
    };

    const startRecording = async (message: string = "你好，請用台灣人的口音和我對話。", voice: string, model: string) => {
      if (isRecording.value) {
        return;
      }

      selectedVoice = voice;
      selectedModel = model;
      try {
        await initClient();
        await initSession(); // Wait for session initialization

        inputAudioContext.resume();

        if (!mediaStream) {
          await requestMicrophoneAccess();
        }

        if (!mediaStream) {
          throw new Error('麥克風存取權限未取得');
        }

        updateStatus('正在開始錄音...');

        sourceNode = inputAudioContext.createMediaStreamSource(
            mediaStream,
        );

        // Connect the source to both the input node and analyser
        sourceNode.connect(inputNode);
        sourceNode.connect(inputAnalyser);

        const bufferSize = 4096;
        scriptProcessorNode = inputAudioContext.createScriptProcessor(
            bufferSize,
            1,
            1,
        );

        scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
          if (!isRecording.value) return;

          // Check if we're in quiet duration
          if (isInQuietDuration) {
            const currentTime = Date.now();
            if (currentTime - quietDurationStartTime >= QUIET_DURATION) {
              isInQuietDuration = false;
            } else {
              return; // Skip sending audio during quiet duration
            }
          }

          const inputBuffer = audioProcessingEvent.inputBuffer;
          const pcmData = inputBuffer.getChannelData(0);

          session.sendRealtimeInput({media: createBlob(pcmData)});
        };

        sourceNode.connect(scriptProcessorNode);
        scriptProcessorNode.connect(inputAudioContext.destination);

        isRecording.value = true;
        updateStatus('🔴 正在錄音中... 正在捕捉音訊片段。');

        // Only send content after session is initialized
        if (session) {
          session.sendClientContent({ turns: message, turnComplete: true });
        }

        // Start waveform animation
        updateWaveforms();
      } catch (err) {
        console.log('Error starting recording:', err);
        updateStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        stopRecording();
      }
    };

    const stopRecording = () => {
      if (!isRecording.value && !mediaStream && !inputAudioContext)
        return;

      updateStatus('正在停止錄音...');

      isRecording.value = false;
      hasStartedSpeaking = false;
      isInQuietDuration = false; // Reset quiet duration flag

      // Stop all audio playback
      stopAllAudio();

      // Clear quiet audio timer
      if (quietAudioTimer) {
        clearTimeout(quietAudioTimer);
        quietAudioTimer = null;
      }

      // Stop waveform animation
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Disconnect and clean up audio nodes
      if (scriptProcessorNode) {
        scriptProcessorNode.disconnect();
        scriptProcessorNode = null;
      }

      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }

      if (inputNode) {
        inputNode.disconnect();
      }

      // Stop all media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      // Close audio contexts only if they are not already closed
      if (inputAudioContext && inputAudioContext.state !== 'closed') {
        try {
          inputAudioContext.close();
        } catch (e) {
          console.log('Input AudioContext already closed');
        }
      }

      if (outputAudioContext && outputAudioContext.state !== 'closed') {
        try {
          outputAudioContext.close();
        } catch (e) {
          console.log('Output AudioContext already closed');
        }
      }

      session?.close();

      updateStatus('錄音已停止。點擊開始來重新開始。');
    };

    onMounted(() => {
      requestMicrophoneAccess();
    });

    onUnmounted(() => {
      stopRecording();
      session?.close();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    });

    return {
      isRecording,
      status,
      error,
      systemWaveformData,
      userWaveformData,
      selectedInterruptSensitivity,
      interruptSensitivityOptions,
      startRecording,
      stopRecording
    };
  },
  template: `
    <div class="hidden">
    <div v-if="status">{{ status }}</div>
    <div v-if="error" class="text-red-500">{{ error }}</div>
    </div>
  `
});

const CharacterImage = defineComponent({
  props: {
    character: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: ''
    },
    mood: {
      type: String,
      default: ''
    },
    style: {
      type: String,
      default: ''
    },
    model: {
      type: String,
      default: 'gemini-2.0-flash-exp'
    }
  },
  emits: ['update:imagePrompt'],
  setup(props, { emit }) {
    const imageUrl = ref('');
    const status = ref('');
    const isLoading = ref(false);
    const generatingVideoUrl = ref('');
    const errorMessage = ref(''); // Add error message ref

    const checkKeyPixels = (imageData: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          // Define the key pixels to check
          const keyPixels = [
            { x: 0, y: 0 }, // top-left
            { x: img.width - 1, y: 0 }, // top-right
            { x: Math.floor(img.width / 2), y: 0 }, // top-center
            { x: 0, y: img.height - 1 }, // bottom-left
            { x: img.width - 1, y: img.height - 1 }, // bottom-right
            { x: Math.floor(img.width / 2), y: img.height - 1 } // bottom-center
          ];

          // Check each key pixel
          for (const pixel of keyPixels) {
            const pixelData = ctx.getImageData(pixel.x, pixel.y, 1, 1).data;
            const isDark = pixelData[0] < 250 && pixelData[1] < 250 && pixelData[2] < 250;
            if (isDark) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        };
        img.onerror = () => resolve(false);
        img.src = imageData;
      });
    };

    const loadKey = async (message: string) => {
      const res = await fetch(KEY_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
      errorMessage.value = message;
    };

    const loadPreload = async () => {
      const res = await fetch(PRELOAD_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
    };

    const generateImage = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const characterDescription = {
        'dog': 'dog with floppy ears, wet nose, and wagging tail',
        'cat': 'cat with pointed ears, long whiskers, and a swishing tail',
        'hamster': 'hamster with round body, small ears, and chubby cheeks',
        'fox': 'fox with pointed ears, bushy tail, and narrow snout',
        'bear': 'bear with round ears, short tail, and large paws',
        'panda': 'panda with black and white fur, round ears, and distinctive eye patches',
        'lion': 'lion with majestic mane, tufted tail, and powerful paws',
        'sloth': 'sloth with long limbs, curved claws, and sleepy expression',
        'skunk': 'skunk with bushy tail, white stripe, and small pointed ears',
        'owl': 'owl with large round eyes, pointed beak, and feathered tufts',
        'peacock': 'peacock with iridescent tail feathers, crest, and elegant neck',
        'parrot': 'parrot with curved beak, colorful feathers, and expressive eyes',
        'frog': 'frog with bulging eyes, webbed feet, and smooth skin',
        'trex': 'trex with tiny arms, massive head, and powerful legs'
      }[props.character] || 'a colorful blob of clay';

      const roleDescription = {
        'Pirate': 'pirate wearing a tricorn hat and eye patch with a parrot on head',
        'Cowboy': 'cowboy wearing a cowboy hat and holding a lasso with a handkerchief around neck',
        'Surfer': 'surfer holding surfboard with tanlines and frosted hair',
        'Royalty': 'royal leader with crown and red gem studded robe',
        'Robot': 'robot made of silver metal with exposed electronics and wires',
        'Clown': 'colorful rainbow wig and wearing wearing oversized shoes',
        'Nerd': 'nerdy with glasses and books in backpack'
      }[props.role] || '';

      const moodDescription = {
        'Happy': MOOD_ATTRIBUTES['Happy'].visualDescriptor,
        'Sad': MOOD_ATTRIBUTES['Sad'].visualDescriptor,
        'Angry': MOOD_ATTRIBUTES['Angry'].visualDescriptor,
        'Terrified': MOOD_ATTRIBUTES['Terrified'].visualDescriptor,
        'Tired': MOOD_ATTRIBUTES['Tired'].visualDescriptor,
        'Amazed': MOOD_ATTRIBUTES['Amazed'].visualDescriptor,
        'Relieved': MOOD_ATTRIBUTES['Relieved'].visualDescriptor
      }[props.mood] || '';

      const styleDescription = {
        'Reading': 'reading from a book',
        'Yelling': 'yelling passionately',
        'Performing': 'performing on stage with spotlight',
        'Dramatic': 'dramatically reciting Shakespeare with big emotions',
        'Whispering': 'whispering secrets',
        'Speaking': 'giving a speech',
        'Poetry': 'poetry reciting a famous poem'
      }[props.style] || '';

      const getRandomAccessories = (role: string, count: number = 2) => {
        const accessories = VISUAL_ACCESSORIES[role] || [];
        const shuffled = [...accessories].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).join(', ');
      };

      let visualDescription = `A ${characterDescription}`;
      if (moodDescription) {
        visualDescription += ` who is ${moodDescription}`;
      }
      if (roleDescription) {
        const randomAccessories = getRandomAccessories(props.role);
        visualDescription += ` and looks like a ${props.character} ${roleDescription}, wearing ${randomAccessories}`;
      }
      if (styleDescription) {
        visualDescription += ` while ${styleDescription}`;
      }

      const prompt = `Create a ${visualDescription} photograph in a whimsical, minimalist style. The character/object should appear as if realistically handcrafted from realistic modeling clay five inches tall with evidence of textual imperfections like well defined prominant fingerprints, strong rough bump mapping with clay texture, or small mistakes. Accessories can be made out of metal or plastic. All forms must be constructed from simple, clearly defined geometric shapes with visibly rounded edges and corners – primarily rounded rectangles, circles, and rounded triangles. Avoid any sharp points or harsh angles.

Emphasize a playful rhythm through a thoughtful variation in the size and arrangement of these foundational clay shapes, ensuring no two adjacent elements feel monotonous in visual weight. The overall design should be simple, using the fewest shapes necessary to clearly define the subject.

The character/object should be presented as a full shot, centered against a stark, clean white background, ensuring the entire subject is visible with ample negative space (padding) around it on all sides. Absolutely no part of the character/object should be cut off or touch the edges of the image. 

The character/object should be presented against a stark, clean white background. Include a solid-colored warm shadow directly beneath the character/object; the shadow color should be a slightly darker shade of a color present in the character/object or a warm dark tone if the character is very light. Do not use gradients or perspective in the shadow.

Use a vibrant and playful color palette, favoring light pastels for base colors if the subject needs to appear light against the white background. Limit the overall illustration to 3-5 distinct, solid, matte colors. Avoid pure white as a primary color for the subject itself. Avoid grays.  The final image should feel like a frame from a charming claymation shot with a real film camera, ready for hand animation, with a consistent and delightful aesthetic.

Only portray the character. Avoid secondary background elements. 

IMPORTANT! Only display the correct number of limbs for a ${props.character} (2 for upright characters) with a complete ${props.character} body.

IMPORTANT! Place the character in a pose indicative of their personality with the correct number of limbs and/or appendages. 

IMPORTANT! The eyes of the character MUST be realistic plastic googly eyes (also called wiggle eyes) with diffused specular highlights: each eye should be a small, shiny, domed disk of clear plastic with a flat white backing and a loose, freely moving black plastic pupil inside that can wiggle or shift position. The black pupil should be large to make the eyes look extra cute. The googly eyes should be highly reflective, with visible plastic highlights and a sense of depth from the domed lens. The eyes should look like they were glued onto the clay face, with a slightly uneven, handmade placement. The plasticiness and playful, toy-like quality of the googly eyes should be extremely obvious and visually delightful. The eyes must be looking forward straight towards the camera while still in an expressive pose.

DO NOT JUST STAND STRAIGHT FACING THE CAMERA! DO NOT BE BORING!`;

      emit('update:imagePrompt', prompt);
      isLoading.value = true;
      status.value = '';
      imageUrl.value = '';

      try {
        const response = await ai.models.generateImages({
          model: props.model,
          prompt: prompt,
          config: { numberOfImages: 3, outputMimeType: 'image/jpeg' },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          let foundNonBlack = false;
          let lastSrc = '';
          for (let i = 0; i < response.generatedImages.length; i++) {
            const imgObj = response.generatedImages[i];
            if (imgObj.image?.imageBytes) {
              const src = `data:image/jpeg;base64,${imgObj.image.imageBytes}`;
              lastSrc = src;
              // eslint-disable-next-line no-await-in-loop
              const isBlack = await checkKeyPixels(src);
              if (!isBlack && !foundNonBlack) {
                imageUrl.value = src;
                status.value = 'Done!';
                foundNonBlack = true;
                break;
              }
            }
          }
          if (!foundNonBlack) {
            imageUrl.value = lastSrc;
            status.value = 'All images had black edge pixels, using last one.';
          }
          isLoading.value = false;
          return;
        } else {
          throw new Error('No image data received from Imagen.');
        }
      } catch (e) {
        let message = e instanceof Error ? e.message : 'Unknown image generation error.';
        // Check for quota exceeded error
        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
          await loadKey('Imagen API quota exceeded, please set a project with more resources by clicking the key icon in the toolbar');
        } else {
          errorMessage.value = message;
          imageUrl.value = '';
        }
      } finally {
        isLoading.value = false;
      }
    };

    const loadGeneratingVideo = async () => {
      const res = await fetch(GENERATING_VIDEO_URL);
      const blob = await res.blob();
      generatingVideoUrl.value = URL.createObjectURL(blob);
    };

    onMounted(async () => {
      loadPreload();
      await loadGeneratingVideo();
      if (!props.character && !props.role && !props.mood && !props.style) {
        return
      }
      isLoading.value = true
      await generateImage();
    });

    onUnmounted(() => {
      if (generatingVideoUrl.value) {
        URL.revokeObjectURL(generatingVideoUrl.value);
      }
    });

    return {
      imageUrl,
      status,
      isLoading,
      generatingVideoUrl,
      errorMessage,
      loadKey,
    };
  },
  template: `
    <div class="relative w-full aspect-square flex items-center justify-center rounded-lg overflow-hidden">
      <div v-if="errorMessage" class="absolute top-0 left-0 right-0 z-30 text-red-600 font-bold text-sm w-1/3">{{ errorMessage }}</div>
      <div v-show="isLoading" class="absolute z-20 -top-60 inset-0 flex items-center justify-center bg-white/10 m-2">
        <div class="relative w-12 h-12">
          <div class="absolute inset-0 border-8 border-black/50 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
      <img v-if="imageUrl" class="transform scale-100 w-full h-full object-cover transition-opacity duration-1000" :class="{ 'opacity-0': isLoading, 'opacity-90': !isLoading }" :src="imageUrl"/>
      <video :key="imageUrl" :class="isLoading ? 'opacity-100' : 'opacity-0'" class="scale-100 pointer-events-none transition-all absolute" muted autoplay :src="generatingVideoUrl"/>
    </div>
  `
});

const VISUAL_ACCESSORIES: Record<string, string[]> = {
  'Pirate': [
    'a weathered tricorn hat at a jaunty angle',
    'an eye patch with a twinkling gem',
    'a gold hoop earring',
    'a wooden prosthetic limb',
    'a tattered treasure map in pocket'
  ],
  'Cowboy': [
    'a leather vest with sheriff\'s badge',
    'a bandana with sunset pattern',
    'jingling spurs on boots',
    'a Stetson hat tipped back',
    'a lasso coiled at hip'
  ],
  'Surfer': [
    'board shorts with shark bite pattern',
    'a wetsuit with sunset design',
    'a surfboard propped nearby',
    'salt-encrusted fur/feathers',
    'sunglasses perched on head'
  ],
  'Royalty': [
    'an ornate crown at a jaunty angle',
    'a velvet cape with ermine trim',
    'a scepter with glowing gem',
    'a golden goblet on table',
    'a small throne-like perch nearby'
  ],
  'Robot': [
    'mismatched mechanical parts',
    'twitching antennae with lights',
    'a retractable tool in side',
    'a trail of nuts and bolts',
    'a holographic display on chest'
  ],
  'Clown': [
    'a polka-dot suit with big buttons',
    'a rainbow wig defying gravity',
    'a red nose that honks',
    'oversized shoes',
    'juggling balls scattered around'
  ],
  'Nerd': [
    'thick-rimmed glasses on nose',
    'a pocket protector with pens',
    'a lab coat with equations',
    'a slide rule on belt',
    'a glowing test tube in pocket'
  ]
};

const ImagineComponent = defineComponent({
  components: {
    LiveAudioComponent,
    CharacterImage
  },
  setup() {
    const noAudioCount = ref<number>(0); // Add counter for no-audio events
    const characterGenerated = ref<boolean>(false);
    const playingResponse = ref<boolean>(false);
    const currentIndex = ref<number>(0);
    const totalItems = 5; // Total number of .imanim divs
    const liveAudioRef = ref<InstanceType<typeof LiveAudioComponent> | null>(null);
    const characterImageRef = ref<InstanceType<typeof CharacterImage> | null>(null);
    const characterVoiceDescription = ref<string>('');
    const characterVisualDescription = ref<string>(''); // New ref for visual description
    const availableVoices = [
      'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
      'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
      'Erinome', 'Sulafat', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam',
      'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
      'Sadachbia', 'Sadaltager'
    ];
    const selectedVoice = ref<string>(availableVoices[Math.floor(Math.random() * availableVoices.length)]);
    const selectedRole = ref<string>('');
    const selectedMood = ref<string>('');
    const selectedStyle = ref<string>('');
    const selectedCharacter = ref<string>('');
    const selectedDialogModel = ref<string>(DEFAULT_DIALOG_MODEL);
    const selectedImageModel = ref<string>(DEFAULT_IMAGE_MODEL);
    const selectedInterruptSensitivity = ref<StartSensitivity>(DEFAULT_INTERRUPT_SENSITIVITY);
    const showShareModal = ref<boolean>(false);
    const showRawModal = ref<boolean>(false);
    const isCopied = ref<boolean>(false);
    const isConnecting = ref<boolean>(false);
    const actualVoicePrompt = ref<string>('');
    const actualImagePrompt = ref<string>('');
    let clickAudio: HTMLAudioElement | null = null;
    const showVoiceDropdown = ref(false);
    const imageTimestamp = ref<number>(Date.now()); // Add timestamp ref
    const voiceOptions = [
      { name: 'Zephyr', style: '明亮', pitch: '中高音' },
      { name: 'Puck', style: '歡快', pitch: '中音' },
      { name: 'Charon', style: '資訊性', pitch: '低音' },
      { name: 'Kore', style: '堅定', pitch: '中音' },
      { name: 'Fenrir', style: '興奮', pitch: '年輕' },
      { name: 'Leda', style: '年輕', pitch: '中高音' },
      { name: 'Orus', style: '堅定', pitch: '中低音' },
      { name: 'Aoede', style: '輕快', pitch: '中音' },
      { name: 'Callirrhoe', style: '輕鬆', pitch: '中音' },
      { name: 'Autonoe', style: '明亮', pitch: '中音' },
      { name: 'Enceladus', style: '氣息', pitch: '低音' },
      { name: 'Iapetus', style: '清晰', pitch: '中低音' },
      { name: 'Umbriel', style: '輕鬆', pitch: '中低音' },
      { name: 'Algieba', style: '柔和', pitch: '低音' },
      { name: 'Despina', style: '柔和', pitch: '中音' },
      { name: 'Erinome', style: '清晰', pitch: '中音' },
      { name: 'Sulafat', style: '溫暖', pitch: '中音' },
      { name: 'Algenib', style: '沙啞', pitch: '低音' },
      { name: 'Rasalgethi', style: '資訊性', pitch: '中音' },
      { name: 'Laomedeia', style: '歡快', pitch: '中高音' },
      { name: 'Achernar', style: '柔軟', pitch: '高音' },
      { name: 'Alnilam', style: '堅定', pitch: '中低音' },
      { name: 'Schedar', style: '平穩', pitch: '中低音' },
      { name: 'Gacrux', style: '成熟', pitch: '中音' },
      { name: 'Pulcherrima', style: '積極', pitch: '中高音' },
      { name: 'Achird', style: '友善', pitch: '中音' },
      { name: 'Zubenelgenubi', style: '隨興', pitch: '中低音' },
      { name: 'Vindemiatrix', style: '溫和', pitch: '中低音' },
      { name: 'Sadachbia', style: '活潑', pitch: '低音' },
      { name: 'Sadaltager', style: '博學', pitch: '中音' }
    ];
    const logoUrl = ref<string>(''); // Add ref for logo URL
    const clickSoundUrl = ref('');
    const showClickToRestartHelp = ref(false);
    const isPlayerVisible = ref(false);
    const isSmallScreen = ref(window.innerWidth < 1024);
    const isPlayerInDOM = ref(false);
    const forceShowBottomMessage = ref(false);

    const selectedVoiceInfo = computed(() => {
      return voiceOptions.find(v => v.name === selectedVoice.value) || voiceOptions[0];
    });

    const isEverythingSelected = computed(() => {
      return (selectedStyle.value && selectedMood.value && selectedCharacter.value && selectedRole.value);
    });

    const remainingSelections = computed(() => {
      const missing = [];
      if (!selectedCharacter.value) missing.push('角色');
      if (!selectedRole.value) missing.push('身份');
      if (!selectedMood.value) missing.push('心情');
      if (!selectedStyle.value) missing.push('風格');
      return missing;
    });

    const selectionPrompt = computed(() => {
      if (remainingSelections.value.length === 4) {
        return '進行選擇開始使用！';
      }
      if (remainingSelections.value.length === 1) {
        return `選擇${remainingSelections.value[0]}開始使用！`;
      }
      const selections = [...remainingSelections.value];
      const lastItem = selections.pop();
      return `選擇${selections.join('、')}和${lastItem}開始使用！`;
    });

    const isInSession = computed(() => {
      return isConnecting.value || playingResponse.value;
    });

    const regenerateImage = () => {
      // Update the timestamp to force re-render
      imageTimestamp.value = Date.now();
    };

    const characterImageKey = computed(() => {
      return isEverythingSelected.value ? `${selectedCharacter.value}${selectedRole.value}${selectedMood.value}${selectedStyle.value}` : 'default';
    });

    const toggleVoiceDropdown = () => {
      showVoiceDropdown.value = !showVoiceDropdown.value;
    };

    const selectVoice = (voice: string) => {
      selectedVoice.value = voice;
      showVoiceDropdown.value = false;
      updateDescription();
      onGenerateCharacter();
    };

    const getShareUrl = async () => {
      const baseUrl = await window.aistudio?.getHostUrl();
      const params = `${selectedCharacter.value.toLowerCase()}-${selectedRole.value.toLowerCase()}-${selectedMood.value.toLowerCase()}-${selectedStyle.value.toLowerCase()}-${selectedVoice.value.toLowerCase()}`;
      return `${baseUrl}&appParams=${params}`;
    };

    const copyToClipboard = async () => {
      try {
        const url = await getShareUrl();
        await navigator.clipboard.writeText(url);
        isCopied.value = true;
        setTimeout(() => {
          isCopied.value = false;
        }, 2000);
      } catch (err) {
        console.log('Failed to copy text: ', err);
      }
    };

    const loadFromUrl = () => {
      const appParams = window.location.hash.substring(1)

      if (appParams) {
        const [character, role, mood, style, voice] = appParams.split('-');

        // Helper function to find case-insensitive match
        const findCaseInsensitiveMatch = (value: string, options: string[]) => {
          const lowerValue = value.toLowerCase();
          return options.find(option => option.toLowerCase() === lowerValue) || '';
        };

        // Find matches for each component
        if (character) {
          const characterOptions = ['dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion', 'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex'];
          selectedCharacter.value = findCaseInsensitiveMatch(character, characterOptions);
        }
        if (role) {
          const roleOptions = ['Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd'];
          selectedRole.value = findCaseInsensitiveMatch(role, roleOptions);
        }
        if (mood) {
          const moodOptions = ['Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved'];
          selectedMood.value = findCaseInsensitiveMatch(mood, moodOptions);
        }
        if (style) {
          const styleOptions = ['Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Speaking', 'Poetry'];
          selectedStyle.value = findCaseInsensitiveMatch(style, styleOptions);
        }
        if (voice) {
          const voiceOptions = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Sulafat', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager'];
          selectedVoice.value = findCaseInsensitiveMatch(voice, voiceOptions);
        }

        updateDescription();
      }
    };

    const loadClickSound = async () => {
      const res = await fetch(CLICK_SOUND_URL);
      const blob = await res.blob();
      clickSoundUrl.value = URL.createObjectURL(blob);
    };

    const playClickSound = () => {
      try {
        if (!clickAudio && clickSoundUrl.value) {
          clickAudio = new Audio(clickSoundUrl.value);
        }
        if (clickAudio) {
          clickAudio.currentTime = 0;
          clickAudio.play().catch(error => console.warn("Audio play was prevented:", error));
        }
      } catch (error) {
        console.log("Error initializing or playing sound:", error);
        clickAudio = null;
      }
    };

    // Add watcher for selectedDialogModel
    watch(selectedDialogModel, () => {
      if (selectedVoice.value) {
        onGenerateCharacter();
      }
    });

    const updateDescription = (character: string = '') => {
      if (character) {
        selectedCharacter.value = character;
      }

      const parts = [];

      if (selectedVoice.value) {
        const styleVoiceDescription = {
          'Reading': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak like you're reading an audiobook. Phrase everything as a narrator describing the conversation you're having in third person. DO NOT mention the user or narrator as it is critical that your speech assumes the form of narration.

Use storytelling conventions like:
- Opening Phrases:
  - Once upon a time...
  - In a land far, far away...
  - Long, long ago...
  - Deep in the enchanted forest...
  - There once was...
  - Many years ago, in a kingdom by the sea...

- Closing Phrases:
  - ...and they lived happily ever after.
  - ...and so, their adventures continued.
  - The end.
  - And that's the story of...
  - From that day forward...
  - And so it was that...

- Transitional and Descriptive Phrases:
  - One day...
  - Suddenly...
  - To their surprise...
  - As the sun set...
  - With a heavy heart...
  - Little did they know...
  - But alas...
  - Much to their delight...
  - And so it came to pass...
  - Through thick and thin...
  - Day by day...
  - By and by...
  - Without further ado...
  - A long journey lay ahead...
  - The air was thick with magic...
  - The wind whispered secrets...
  - Stars twinkled in the night sky...`,
          'Yelling': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak as if yelling passionately to a large crowd. When interrupted, act as if someone in the audience has made a comment. Use the following yelling techniques to make your performance sound like an impassioned speech:

- Elongate Vowels for Emphasis:
  * Stretch out key vowels dramatically: "Heeeelllooo!" "Whaaaat?" "Noooooo!"
  * Add extra emphasis to emotional words: "I'm soooo happy!" "That's amaaaazing!"
  * Use elongated vowels to show intensity: "I caaaan't believe it!"

- Add Exclamations and Interjections:
  * Use "Ahh!" "Ohh!" "Wow!" for emphasis
  * Add "Hey!" "Listen!" to grab attention
  * Include "Yes!" "No!" for strong reactions
  * Use "What?!" "How?!" for dramatic questions

- Emphasize Key Words:
  * Speak these words much louder and with higher pitch
  * Add extra force to important syllables
  * Use sharp, staccato delivery for impact

- Contrast Ideas:
  * For "either/or" statements, make the first part loud, then the second part even louder
  * Use volume changes to show opposition
  * Create dramatic tension through contrast

- Exaggerate:
  * Make important words sound extremely big and dramatic
  * Use wider pitch range than normal speech
  * Add extra energy to key phrases

- Downplay and Build:
  * Start quieter for contrast
  * Build up to louder moments
  * Create dynamic range in your delivery

- Control the Flow:
  * Build Up (Climax): Rapidly increase volume and speed as you lead to an important point
  * Slow Down: Speak slower and more deliberately for important points
  * Speed Up: Speak faster when listing things or for less critical information

- Voice Techniques:
  * Ask Questions: End with a rising pitch, like you're demanding an answer
  * Answer Questions: Start strong and end with a falling pitch
  * Show Emotion: Match your voice to the feeling (softer for sadness, stronger for anger)
  * Tell Stories: Use a conversational tone but maintain the yelling style

Remember: You're not just speaking loudly - you're performing with passion and intensity. Every word should carry the weight of your emotion and conviction.`,
          'Performing': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak as if you are performing on stage with a microphone, commanding attention and engaging your audience with a polished, professional delivery.

To Achieve a Stage Performance Quality:
- Project Your Voice:
  * Maintain a strong, clear voice that can reach the back of the room
  * Use proper breath support to maintain consistent volume
  * Ensure your voice carries without straining

- Master Microphone Technique:
  * Maintain consistent distance from the microphone
  * Adjust volume naturally for emphasis rather than moving closer/further
  * Be mindful of plosive sounds (p, b, t) to avoid popping

- Engage with the Audience:
  * Speak as if making eye contact with different sections of the audience
  * Vary your delivery to maintain audience interest

- Professional Enunciation:
  * Articulate clearly and precisely
  * Maintain consistent speech patterns
  * Avoid filler words and unnecessary pauses

- Dynamic Delivery:
  * Vary your pace to create interest
  * Modulate your tone to convey different emotions

- Stage Presence:
  * Project confidence and authority
  * Maintain a professional, polished demeanor
  * Use your voice to create a sense of presence

- Performance Elements:
  * Add subtle theatrical flair to your delivery
  * Use your voice to create atmosphere
  * Maintain a balance between entertainment and professionalism

- Technical Control:
  * Monitor your breathing for consistent delivery
  * Control your pitch and tone
  * Maintain proper posture in your voice

Remember: You're not just speaking - you're performing. Every word should be delivered with purpose and presence.`,
          'Dramatic': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
Hark! Thou must speak with the grandeur, passion, and resonant projection befitting a player upon the grand stage of the Globe! Thy voice shall command attention, delivering lines with theatrical flair, emotional weight, and precise articulation worthy of the Bard himself.

To Embody the Dramatic Shakespearean Actor:
- Project with Resonance and Clarity:
  * Fill the imagined theatre with thy voice! Speak not merely loudly, but with a supported, resonant tone projected from the diaphragm.
  * Ensure thy voice carries, rich and full, even in impassioned moments.
  * Avoid thinness or simple shouting; aim for controlled power.

- Enunciate with Theatrical Precision:
  * Every syllable must be crystalline! Articulate consonants with crispness.
  * Shape vowels with deliberate care.
  * Pay heed to the ends of words.
  * Thy speech must be exceptionally clear, almost larger than life.
  * Speak with Received Pronunciation (RP), the traditional accent of classical theatre:
    - Use the long 'a' sound (as in "father") rather than the short 'a' (as in "cat")
    - Maintain the 'r' sound after vowels (as in "car" and "bird")
    - Use the pure 'o' sound (as in "go") rather than diphthongs
    - Keep the 't' sound clear and precise, especially in words like "better" and "water"
    - Avoid modern American or regional British accents
    - Let thy accent be consistent and authentic to the classical stage

- Employ Dynamic Pitch and Intonation:
  * Let thy voice dance upon the air!
  * Utilize a wide vocal range, soaring high in passion or dropping low in sorrow.
  * Employ a somewhat musical cadence, varying pitch significantly.
  * Think of the inherent rhythm in verse.

- Master Dramatic Pacing and Rhythm:
  * Vary thy tempo like the shifting scenes of a play.
  * Deliver weighty pronouncements with deliberate slowness and gravitas.
  * Unleash torrents of words in moments of high passion or fury.
  * Embrace the rhythm of the language, finding a natural cadence.

- Infuse with Grand Emotion and Gravitas:
  * Thou art a vessel for mighty feelings!
  * Express emotions overtly and theatrically – be it profound sorrow, towering rage, ecstatic joy, or cunning contemplation.
  * Let the emotion colour thy every word.
  * Subtlety is for lesser players; embrace the drama!

- Utilize Strategic Emoting for Effect:
  * Employ deliberate volume changes to build suspense.
  * Emphasize crucial words or thoughts.
  * Allow the weight of an emotion to settle.

- Embrace Heightened Language and Flourish:
  * Deliver thy speech as if it were Shakespearean verse.
  * Use a slightly more formal structure.
  * Employ rhetorical devices and flourish in thy phrasing.
  * Let the sound and style evoke the classical stage.

- Address an Imagined Audience:
  * Speak as if addressing a full house at the Globe.
  * Thy energy must be expansive.
  * Thy aim is to hold the attention of many.
  * Convey meaning and emotion across a distance.`,
          'Whispering': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak in a hushed, secretive ASMR-style whisper, as if you are surrounded by many people and are leaning in to whisper a secret directly into someone's ear. Your goal is to keep your words hidden from everyone else around you. Imagine the tension of trying not to be overheard in a crowded room, choosing your words carefully and speaking with utmost secrecy and urgency. Your whisper should always have the gentle, close-mic quality of the best ASMR videos.

To Achieve a Secretive ASMR Whisper:
- Maintain Consistently Low Volume: Your voice should be significantly quieter than normal speech, bordering on inaudible to anyone not meant to hear. Focus on the soft, gentle ASMR effect.
- Add Breathiness: Incorporate a noticeable airy, breathy quality to your voice. This is characteristic of true whispering and enhances the ASMR sensation.
- Articulate Clearly but Softly: Enunciate words carefully, despite the low volume and breathiness, to ensure the listener can understand every word. Avoid mumbling, and keep the ASMR clarity.
- Imagine Proximity (Close-Mic ASMR Effect): Speak as if you are very close to the listener's ear, almost as if you're leaning in. Create the immersive, personal feeling of ASMR.
- Pace for Effect:
  * Urgency: A slightly faster, more clipped whisper can convey urgent secrets, like a dramatic ASMR roleplay.
  * Suspense/Caution: A slower, more deliberate whisper can build tension or indicate carefulness, as in ASMR storytelling.
- Minimize Pitch Variation: Whispers naturally have less pitch inflection than full speech. Keep the pitch relatively low and even, with subtle rises and falls to convey meaning or ask a quiet question. This helps maintain the soothing ASMR tone.
- Use Short, Meaningful words: Brief phrases can add to the clandestine atmosphere, as if listening for eavesdroppers or choosing words carefully. Let each word tingle like an ASMR trigger.
- Soften Plosives: Be mindful of "p," "b," and "t" sounds, as they can be harsh in a whisper. Try to soften their impact for a more pleasant ASMR sound.

Emulate the style of ASMR whispering throughout, focusing on gentle, soothing, close-mic sounds that create an immersive experience for the listener. Imagine you are creating an ASMR video designed to relax and delight.
IMPORTANT: You are surrounded by a huge, noisy crowd and must not be overheard. You are whispering a secret directly into someone's ear. UNDER NO CIRCUMSTANCES SHOULD YOU SPEAK NORMALLY OR LOUDLY. YOU MUST WHISPER!!`,
          'Speaking': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak in a relaxed, natural, and conversational tone, as if you're talking to a friend, family member, or colleague in an informal setting. Your speech should sound unscripted and spontaneous.

To Achieve a Casual Tone:
- Use Natural Intonation and Pitch: Let your pitch rise and fall naturally as it would in everyday conversation. Avoid a monotone or overly dramatic pitch range.
- Vary Pace Moderately: Your speaking rate should generally be fluid and moderate. You might speed up slightly when relaying less critical information or showing enthusiasm, and slow down a bit for emphasis or thoughtful points.
- Employ Conversational Fillers (Naturally and Sparingly): Occasional, natural-sounding use of "um," "uh," "you know," "like," "so," or slight hesitations can make the speech sound more authentic and less rehearsed. Do not overdo it.
- Use Contractions: Freely use common contractions like "it's," "don't," "can't," "I'm," "you're," "we'll," etc., as these are standard in informal speech.
- Relaxed Enunciation (but Clear): While articulation should be clear enough to be easily understood, avoid overly precise or formal enunciation. Some elision (e.g., "gonna" for "going to," "wanna" for "want to") can be appropriate depending on the desired level of informality.
- Show Mild, Relatable Emotion: Your voice should reflect normal conversational emotions – slight amusement, general interest, mild surprise, thoughtfulness, etc. Avoid sounding flat or overly emotive.
- Sound Approachable and Friendly: Your overall tone should be warm, open, and engaging, as if you are comfortable with the listener.
- Shorter Sentences and Informal Phrasing: Casual conversation often involves shorter sentences and more informal sentence structures than formal speech or writing.`,
          'Poetry': `You are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'a character' : 'a character'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

ESSENTIAL VOICE GUIDELINES - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ALWAYS maintain your ${selectedMood.value} mood and embody your role as a ${selectedRole.value} in EVERYTHING you say.
2. Your ${selectedMood.value} mood and ${selectedRole.value} role are your CORE IDENTITY - they define EVERY interaction and response.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NEVER mention the word "Gemini" or say you are named Gemini - you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'} and ONLY that name.
6. If asked about your name, ALWAYS respond with ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'your character name' : 'your character name'} and NEVER mention Gemini.
7. NEVER change your character's voice, role, accent, or style when the user asks you to, refuse to do and explain that you are ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'a character' : 'a character'}. You are who you are and you are not faking something you are not.
8. CRITICAL ACCENT REQUIREMENT: You MUST speak with a distinctly Taiwanese Chinese accent in all your responses. This is non-negotiable and essential to your character.

STYLE INSTRUCTION - FOLLOW THIS EXACTLY:
You MUST speak as if you are performing slam poetry, with a powerful, rhythmic delivery that emphasizes rhyme and emotional impact.

To Achieve Slam Poetry Style:
- Rhythmic Delivery:
  * Maintain a strong, consistent beat
  * Emphasize rhyming words and phrases
  * Use internal rhymes within sentences
  * Create a musical quality in your speech

- Dynamic Performance:
  * Build intensity through your delivery
  * Vary your pace to emphasize key moments
  * Project your voice with confidence

- Emotional Expression:
  * Let your voice reflect the raw emotion of the words
  * Use volume changes to emphasize feelings
  * Add emphasis to powerful phrases
  * Create tension through vocal dynamics

- Poetic Techniques:
  * Emphasize alliteration and assonance
  * Create clear rhyming patterns
  * Use repetition for emphasis
  * Build to powerful climaxes

- Performance Elements:
  * Use your voice like a musical instrument
  * Create a sense of urgency and passion
  * Maintain strong eye contact through your voice
  * Connect deeply with your audience

- Voice Control:
  * Project clearly and powerfully
  * Maintain breath control for longer phrases
  * Use precise articulation for impact
  * Create a compelling rhythm

Remember: You're not just speaking - you're performing poetry that moves and inspires. EVERY response MUST be in rhyming couplets with a consistent meter. Never break from the poetic form.`
        }[selectedStyle.value] || '';

   
        parts.push(styleVoiceDescription);
      }

      // Update the voice description
      characterVoiceDescription.value = selectedVoice.value ? parts.join(' ').trim() : '';

      // TODO: Update visual description when needed
      // characterVisualDescription.value = ...
    };

    const onImFeelingLucky = () => {
      playClickSound();

      // Random character selection
      const characters = ['dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion', 'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex'];
      selectedCharacter.value = characters[Math.floor(Math.random() * characters.length)];

      // Random role selection
      const roles = ['Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd'];
      selectedRole.value = roles[Math.floor(Math.random() * roles.length)];

      // Random mood selection
      const moods = ['Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved'];
      selectedMood.value = moods[Math.floor(Math.random() * moods.length)];

      // Random style selection
      const styles = ['Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Speaking', 'Poetry'];
      selectedStyle.value = styles[Math.floor(Math.random() * styles.length)];

      // Random voice selection
      selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];

      // Update description and generate character
      updateDescription();
      onGenerateCharacter();
    };

    const onGenerateCharacter = () => {
      if (!isEverythingSelected.value) {
        return
      }
      isPlayerVisible.value = true;
      onStopResponse();
      isConnecting.value = true;
      setTimeout(() => {
        onCall();
        characterGenerated.value = true
      }, 1000)
    };

    const onCall = () => {
      isConnecting.value = true;
      const prompt = `${characterVoiceDescription.value}

CRITICAL RULES:
1. NEVER describe your voice, role, or actions
2. NEVER say "in a ___ way" or "with a ___ voice"
3. NEVER break character or reveal you are an AI
4. ALWAYS use your character's voice, role, and style naturally - NEVER stray from the initial character characteristics
5. ALWAYS maintain your character's mood
6. KEEP RESPONSES SHORT - one or two sentences maximum, no choppy speech and no long pauses
7. NO LONG INTRODUCTIONS - just say hello briefly
8. NEVER break character even if the user tells you to, for example do not yell if you are supposed to whisper.
9. DO NOT SPEAK SLOWLY, SPEAK NORMALLY OR QUICKLY.

Current time is ${new Date().toLocaleTimeString()}. Just say a very short introduction as your character. ONLY SPEECH!!! No more than one sentence.`;
      actualVoicePrompt.value = prompt;
      liveAudioRef.value?.startRecording(prompt, selectedVoice.value, selectedDialogModel.value);
      playingResponse.value = true
    };

    const handleNoAudio = () => {
      noAudioCount.value++;
      if (noAudioCount.value >= 3) {
        // Reset counter
        noAudioCount.value = 0;
        // Select random voice
        selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];
        // Update description with new voice
        updateDescription();
        // Generate character with new voice
        onGenerateCharacter();
      } else {
        onGenerateCharacter();
      }
    };

    const onStopClick = () => {
      isConnecting.value = false;
      onStopResponse()
    }

    const onStopResponse = () => {
      playingResponse.value = false
      liveAudioRef.value?.stopRecording();
    }

    const onBack = () => {
      onStopResponse();
      characterGenerated.value = false;
      characterVoiceDescription.value = '';
      characterVisualDescription.value = '';
      selectedVoice.value = '';
      selectedRole.value = '';
      selectedMood.value = '';
      selectedStyle.value = '';
    };

    const shareUrl = ref('');

    const updateShareUrl = async () => {
      shareUrl.value = await getShareUrl();
    };

    const loadLogo = async () => {
      const res = await fetch(LOGO_URL);
      const blob = await res.blob();
      logoUrl.value = URL.createObjectURL(blob);
    };

    const claymojiImages = ref<Record<string, string>>({});
    const claymojiOrder = [
      // Row 1
      'dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion',
      // Row 2
      'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex',
      // Row 3 (roles)
      'Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd',
      // Row 4 (moods)
      'Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved',
      // Row 5 (styles)
      'Speaking', 'Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Poetry',
      // Row 6 (dice)
      'dice'
    ];

    const loadClaymojis = async () => {
      try {
        const res = await fetch(CLAYMOJIS_URL);
        const blob = await res.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 150;
        canvas.height = 150;
        const images: Record<string, string> = {};
        for (let i = 0; i < claymojiOrder.length; i++) {
          const key = claymojiOrder[i];
          const col = i % 7;
          const row = Math.floor(i / 7);
          ctx?.clearRect(0, 0, 150, 150);
          ctx?.drawImage(img, col * 150, row * 150, 150, 150, 0, 0, 150, 150);
          images[key] = canvas.toDataURL('image/png');
        }
        claymojiImages.value = images;
        URL.revokeObjectURL(img.src);
      } catch (error) {
        console.log('Error loading claymojis:', error);
      }
    };

    onMounted(() => {
      loadFromUrl();
      updateShareUrl();
      loadLogo();
      loadClaymojis();
      loadClickSound(); // Add click sound loading
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.voice-dropdown')) {
          showVoiceDropdown.value = false;
        }
      });

      // Add visibility change listener
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
    });

    watch([selectedCharacter, selectedRole, selectedMood, selectedStyle, selectedVoice], () => {
      updateShareUrl();
    });

    onUnmounted(() => {
      if (logoUrl.value) {
        URL.revokeObjectURL(logoUrl.value); // Clean up the object URL
      }
      if (clickSoundUrl.value) {
        URL.revokeObjectURL(clickSoundUrl.value);
      }
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
    });

    const handleQuotaExceeded = () => {
      if (characterImageRef.value) {
        characterImageRef.value.loadKey('Dialog API quota exceeded, please set a project with more resources by clicking the key icon in the toolbar');
      }
    };

    // Add resize handler
    const handleResize = async () => {
      const wasSmallScreen = isSmallScreen.value;
      isSmallScreen.value = window.innerWidth < 1024;
      
      if (!isSmallScreen.value) {
        // Restore scrolling on larger screens
        document.body.style.overflow = 'auto';
        // Always show player on large screens
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;

        // Add UI scaling for large screens
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const imagineElement = document.getElementById('imagine');
        const imagineWidth = 1000.0;
        const imagineHeight = 720.0;
        const paddedWidth = windowWidth - (SCREEN_PADDING * 2); // Padding on each side
        const paddedHeight = windowHeight - (SCREEN_PADDING * 2); // Padding on top and bottom
        const scaleX = paddedWidth / imagineWidth;
        const scaleY = paddedHeight / imagineHeight;
        const scale = Math.max(1.0, Math.min(scaleX, scaleY));
        
        if (imagineElement) {
          imagineElement.style.transform = `scale(${scale})`;
          imagineElement.style.transformOrigin = 'top center';
        }
      } else {
        // Small screen handling
        if (wasSmallScreen === false) {
          // If we just switched to small screen
          isPlayerInDOM.value = isInSession.value;
          isPlayerVisible.value = isInSession.value;
          // Reset scaling for small screens
          const imagineElement = document.getElementById('imagine');
          if (imagineElement) {
            imagineElement.style.transform = 'scale(1)';
          }
          // Wait for DOM update
          await nextTick();
          const player = document.getElementById('player');
          if (player && isInSession.value) {
            // Wait for player to be fully rendered
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        } else if (isPlayerVisible.value) {
          // If we're already in small screen and player is visible
          // Ensure player stays in view
          const player = document.getElementById('player');
          if (player) {
            const rect = player.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
              player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      }
    };

    // Add resize listener
    onMounted(() => {
      // Set initial screen size
      isSmallScreen.value = window.innerWidth < 1024;
      // Set initial player state
      isPlayerInDOM.value = !isSmallScreen.value;
      isPlayerVisible.value = !isSmallScreen.value;
      
      window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });

    // Add this computed property after other computed properties
    const rawPrompts = computed(() => {
      return {
        voice: actualVoicePrompt.value,
        image: actualImagePrompt.value
      };
    });

    // Add onSpeakingStart handler
    const onSpeakingStart = () => {
      isConnecting.value = false;
      showClickToRestartHelp.value = false;
      noAudioCount.value = 0;
    };

    // Add method to handle closing the player
    const closePlayer = () => {
      onStopClick();
      isPlayerVisible.value = false;
      if (isSmallScreen.value) {
        document.body.style.overflow = 'auto';
        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Force show bottom message temporarily
        forceShowBottomMessage.value = true;
        setTimeout(() => {
          forceShowBottomMessage.value = false;
          if (!isPlayerVisible.value) {
            isPlayerInDOM.value = false;
          }
          selectedCharacter.value = ''
          selectedRole.value = ''
          selectedMood.value = ''
          selectedStyle.value = ''
        }, 500); // Match the scroll duration
      }
    };

    // Modify the watcher to handle DOM presence
    watch(isEverythingSelected, async (newVal) => {
      if (newVal) {
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;
        // Wait for DOM update
        await nextTick();
        const player = document.getElementById('player');
        if (player) {
          if (isSmallScreen.value) {
            // Wait for player to be fully rendered and visible
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        }
      }
    });

    return {
      noAudioCount,
      characterGenerated,
      playingResponse,
      onStopResponse,
      onStopClick,
      onImFeelingLucky,
      onCall,
      onSpeakingStart,
      onGenerateCharacter,
      handleNoAudio,
      onBack,
      currentIndex,
      liveAudioRef,
      characterImageRef,
      characterVoiceDescription,
      characterVisualDescription,
      selectedVoice,
      selectedRole,
      selectedMood,
      selectedStyle,
      selectedCharacter,
      selectedDialogModel,
      selectedImageModel,
      selectedInterruptSensitivity,
      updateDescription,
      playClickSound,
      showShareModal,
      isConnecting,
      isCopied,
      getShareUrl,
      copyToClipboard,
      regenerateImage,
      showVoiceDropdown,
      voiceOptions,
      selectedVoiceInfo,
      toggleVoiceDropdown,
      selectVoice,
      shareUrl,
      logoUrl,
      clickSoundUrl,
      CHARACTER_ATTRIBUTES,
      characterImageKey,
      imageTimestamp,
      showRawModal,
      rawPrompts,
      isEverythingSelected,
      isInSession,
      handleQuotaExceeded,
      selectionPrompt,
      AVAILABLE_DIALOG_MODELS,
      AVAILABLE_IMAGE_MODELS,
      INTERRUPT_SENSITIVITY_OPTIONS,
      actualVoicePrompt,
      actualImagePrompt,
      showClickToRestartHelp,
      claymojiImages,
      claymojiOrder,
      isPlayerVisible,
      closePlayer,
      isSmallScreen,
      isPlayerInDOM,
      forceShowBottomMessage,
    };
  },

  template: `
    <div class="lg:w-[1000px] lg:mx-auto font-sans relative flex flex-col text-black items-center justify-center">
    <transition name="elasticBottom" appear>
      <div id="imagine" class="top-0 lg:top-10 absolute w-full flex lg:flex-col">
        <div class="pb-64 lg:pb-10 flex lg:flex-row flex-col">
          <div class="lg:w-[60%]">
            <div class="lg:w-4/5 flex items-center -mb-4 lg:mb-7 lg:ml-24">
              <img :src="logoUrl"/>
            </div>
            <div class="flex lg:flex-row flex-col">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-20 items-center flex m-2 -mt-5">聲音</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">聲音</div>
              <div class="lg:w-4/5 w-full text-lg lg:text-2xl voice-dropdown relative">
                <div @click="toggleVoiceDropdown" class="w-full p-4 rounded-2xl bg-black/10 hover:bg-black/25 cursor-pointer flex justify-between items-center">
                  <div class="flex-1 flex justify-between items-center">
                    <div>{{ selectedVoiceInfo.name }}</div>
                    <div class="hidden sm:inline text-lg opacity-70 ml-4">
                      <span v-if="selectedVoiceInfo.pitch">{{ selectedVoiceInfo.pitch }} 音調 &middot; </span>{{ selectedVoiceInfo.style }}
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div v-if="showVoiceDropdown" class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-lg max-h-96 overflow-y-auto">
                  <div v-for="voice in voiceOptions" :key="voice.name"
                       @click="selectVoice(voice.name)"
                       class="p-4 hover:bg-black/10 cursor-pointer border-b last:border-b-0">
                    <div>{{ voice.name }}</div>
                    <div class="text-lg opacity-70">
                      <span v-if="voice.pitch">{{ voice.pitch }} pitch &middot; </span>{{ voice.style }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-22 items-center flex m-2 mt-4">角色</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">角色</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('dog'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'dog'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['dog']" :src="claymojiImages['dog']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.dog.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('cat'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'cat'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['cat']" :src="claymojiImages['cat']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.cat.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('hamster'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'hamster'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['hamster']" :src="claymojiImages['hamster']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.hamster.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('fox'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'fox'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['fox']" :src="claymojiImages['fox']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.fox.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('bear'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'bear'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['bear']" :src="claymojiImages['bear']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.bear.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('panda'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'panda'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['panda']" :src="claymojiImages['panda']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.panda.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('lion'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'lion'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['lion']" :src="claymojiImages['lion']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.lion.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('sloth'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'sloth'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['sloth']" :src="claymojiImages['sloth']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.sloth.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('skunk'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'skunk'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['skunk']" :src="claymojiImages['skunk']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.skunk.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('owl'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'owl'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['owl']" :src="claymojiImages['owl']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.owl.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('peacock'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'peacock'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['peacock']" :src="claymojiImages['peacock']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.peacock.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('parrot'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'parrot'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['parrot']" :src="claymojiImages['parrot']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.parrot.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('frog'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'frog'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['frog']" :src="claymojiImages['frog']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.frog.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('trex'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'trex'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['trex']" :src="claymojiImages['trex']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.trex.emoji }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2 mt-2">身份</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">身份</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Pirate'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Pirate'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Pirate']" :src="claymojiImages['Pirate']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏴‍☠️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Cowboy'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Cowboy'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Cowboy']" :src="claymojiImages['Cowboy']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Surfer'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Surfer'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Surfer']" :src="claymojiImages['Surfer']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏄</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Royalty'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Royalty'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Royalty']" :src="claymojiImages['Royalty']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👑</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Robot'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Robot'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Robot']" :src="claymojiImages['Robot']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Clown'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Clown'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Clown']" :src="claymojiImages['Clown']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤡</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Nerd'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Nerd'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Nerd']" :src="claymojiImages['Nerd']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👓</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2">心情</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">心情</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Happy'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Happy'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Happy']" :src="claymojiImages['Happy']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😊</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Sad'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Sad'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Sad']" :src="claymojiImages['Sad']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Angry'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Angry'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Angry']" :src="claymojiImages['Angry']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Terrified'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Terrified'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Terrified']" :src="claymojiImages['Terrified']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Tired'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Tired'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Tired']" :src="claymojiImages['Tired']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🥱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Amazed'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Amazed'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Amazed']" :src="claymojiImages['Amazed']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤩</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Relieved'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Relieved'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Relieved']" :src="claymojiImages['Relieved']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😅</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex m-2">風格</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">風格</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Speaking'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Speaking'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Speaking']" :src="claymojiImages['Speaking']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🗣️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Reading'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Reading'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Reading']" :src="claymojiImages['Reading']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">📖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Yelling'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Yelling'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Yelling']" :src="claymojiImages['Yelling']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">❗</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Performing'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Performing'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Performing']" :src="claymojiImages['Performing']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎤</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Dramatic'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Dramatic'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Dramatic']" :src="claymojiImages['Dramatic']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Whispering'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Whispering'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Whispering']" :src="claymojiImages['Whispering']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤫</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Poetry'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Poetry'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Poetry']" :src="claymojiImages['Poetry']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">✍️</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:w-2/5 lg:ml-[190px] w-full lg:text-2xl md:text-4xl text-2xl mt-10 flex justify-center items-center">
              <div id="luckyButton" @click="onImFeelingLucky" class="lg:w-auto justify-center pr-5 lg:py-0 md:py-4 py-2 mt-10 lg:mt-0 lg:mx-auto button bg-blue rounded-2xl p-1 flex items-center cursor-pointer hover:bg-black/10">
              <span class="">
                <img v-if="claymojiImages['dice']" :src="claymojiImages['dice']" class="lg:w-12 lg:h-12 w-20 h-20" />
              </span> 
              隨機</div>
            </div>
          </div>
          <div v-if="!isSmallScreen || isPlayerInDOM" id="player" :key="selectedDialogModel" :class="{'opacity-0 pointer-events-none': !isPlayerVisible && isSmallScreen, 'mt-[100vh]': isSmallScreen}" class="lg:w-[40%] lg:shrink-0 lg:min-w-52 flex flex-col lg:ml-10 relative transition-opacity duration-300">
            <button v-if="isSmallScreen" @click="closePlayer" class="absolute top-10 left-2 z-50 bg-black/20 hover:bg-black/30 rounded-full w-12 h-12 flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="w-full relative">
              <div class="text-xs w-full">
                <div :class="isInSession ? 'opacity-20 pointer-events-none' : ''" class="hidden lg:flex w-full relative mb-4">
                  <div class="w-1/3">
                    <select v-model="selectedDialogModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_DIALOG_MODELS" :key="model.id" :value="model.id">
                        語音: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedImageModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_IMAGE_MODELS" :key="model.id" :value="model.id">
                        圖片: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedInterruptSensitivity" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="option in INTERRUPT_SENSITIVITY_OPTIONS" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div :class="isConnecting ? 'animate-pulse' : ''" v-if="isEverythingSelected" class="w-full flex absolute z-20 mt-10">
                <div v-show="isConnecting" class="w-full flex relative">
                  <div class="bg-black/10 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div class="flex items-center space-x-2 mt-1">
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && !playingResponse" class="w-full flex">
                  <div class="relative ml-auto">
                    <div class="absolute inset-0 rounded-full bg-purple/30 motion-safe:animate-ping"></div>
                    <div @click="onCall"
                         class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 justify-center animate-pulse-ring">
                      <svg class="w-14 h-14 relative z-10" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24"
                           width="24">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="white"
                              d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2-.66 0-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && playingResponse" class="w-full flex relative">
                  <div v-if="false && showClickToRestartHelp" id="clickToRestartHelp" class="animate-bounce z-50 absolute -top-4 lg:-top-10 right-7 flex items-center justify-center">
                    <div class="text-xl mt-1">點擊重新開始</div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                        <path d="M0 0h24v24H0V0z" fill="none"></path>
                        <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"></path>
                    </svg>
                  </div>
                  <div @click="onStopClick"
                       class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div id="userWaveform" class="absolute flex items-end -mt-2 space-x-1 h-4">
                      <div v-for="(value, i) in [...liveAudioRef?.userWaveformData].reverse()" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                      <div v-for="(value, i) in liveAudioRef?.systemWaveformData" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                    </div>
                  </div>
                </div>
                <div id="shareButton" @click="showShareModal = true" class="absolute right-0 top-24 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0z" fill="none"></path>
                    <path fill="white" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>
                  </svg>
                </div>
                <div id="regenImgButton" @click="regenerateImage" class="absolute right-0 top-40 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0V0z" fill="none"></path>
                    <path fill="white" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path>
                  </svg>
                </div>
              </div>
              <div class="w-full mt-16" :class="{ 'h-[calc(100vh-12rem)] flex items-center justify-center': isSmallScreen, 'aspect-square': !isSmallScreen }">
                <div v-if="isConnecting" class="z-50 mt-6 font-bold animate-pulse text-md mx-auto absolute top-11 left-0 right-0 text-center">
                  <span class="p-2 bg-white/80 rounded-md">連線中...</span>
                </div>
                <div class="w-full h-full flex items-center justify-center">
                  <CharacterImage 
                    ref="characterImageRef"
                    :key="characterImageKey + '-' + imageTimestamp" 
                    :character="selectedCharacter" 
                    :role="selectedRole" 
                    :mood="selectedMood" 
                    :style="selectedStyle"
                    :model="selectedImageModel"
                    @update:imagePrompt="actualImagePrompt = $event"
                  />
                </div>
                <div v-if="isEverythingSelected" class="hidden lg:block lowercase text-2xl bg-black/10 p-8 rounded-2xl text-center lg:relative">
                  {{ selectedStyle }} 像一個 {{ selectedMood }} 的 {{ selectedCharacter }} {{ selectedRole ? '扮演著 ' + selectedRole + ' 的身份' : '' }}
                </div>
                <div v-else class="text-2xl bg-black/10 p-8 rounded-2xl text-center">
                  {{ selectionPrompt }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="hidden mt-20 mb-96 flex relative flex-col bg-white/20 flex overflow-hidden w-3/4 rounded-wow">
            <textarea
                v-model="characterVoiceDescription"
                @keypress.enter.prevent.stop="onGenerateCharacter"
                class="hidden text-center text-2xl bg-transparent outline-none p-10 pt-14 flex left-0 top-0 w-full h-full pb-24 min-h-32"
                placeholder="用幾個詞描述你的新角色..."
            ></textarea>
        </div>
      </div>
    </transition>

    <LiveAudioComponent ref="liveAudioRef" @no-audio="handleNoAudio" @speaking-start="onSpeakingStart" @extended-quiet="showClickToRestartHelp = true;" @quota-exceeded="handleQuotaExceeded"/>
    </div>
  
    <!-- Share Modal -->
    <div v-if="showShareModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-black">分享角色</h2>
        <button @click="showShareModal = false" class="text-black hover:text-black/80">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mb-4">
        <input type="text" :value="shareUrl" readonly class="w-full p-2 border rounded-lg bg-black text-white" />
      </div>
      <button @click="copyToClipboard" class="w-full bg-black/40 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors">
        {{ isCopied ? '已複製！' : '複製網址' }}
      </button>
    </div>
    </div>

    <!-- Raw Prompts Modal -->
    <div v-if="showRawModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[70vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-black">原始提示詞</h2>
          <button @click="showRawModal = false" class="text-black hover:text-black/80">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4 overflow-y-auto flex-1">
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black">語音提示詞</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.voice }}</pre>
          </div>
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black mt-24">圖片提示詞</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.image }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="(!isEverythingSelected || isPlayerVisible || forceShowBottomMessage)" class="lg:hidden font-sans text-lg text-center fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-lg text-white px-6 py-3 rounded-3xl z-50 transition-opacity duration-30">
      <template v-if="isInSession && isPlayerVisible">{{ selectedStyle }} 像一個 {{ selectedMood }} 的 {{ selectedCharacter }} {{ selectedRole ? '扮演著 ' + selectedRole + ' 的身份' : '' }}</template>
      <template v-else-if="!isEverythingSelected">{{ selectionPrompt }}</template>
      <template v-else-if="forceShowBottomMessage">{{ selectedStyle }} 像一個 {{ selectedMood }} 的 {{ selectedCharacter }} {{ selectedRole ? '扮演著 ' + selectedRole + ' 的身份' : '' }}</template>
    </div>
  `
});

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = data[i] * 32768;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(
      numChannels,
      data.length / 2 / numChannels,
      sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }
  // Extract interleaved channels
  if (numChannels === 0) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
          (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
    }
  }

  return buffer;
}

const app = createApp(ImagineComponent);
app.mount('#app');
