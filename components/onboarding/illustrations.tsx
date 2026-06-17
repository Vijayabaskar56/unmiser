import { useThemeColor } from "heroui-native";
import { G, Path, Rect, Circle, Line, Ellipse, Svg, Text as SvgText } from "react-native-svg";
import type { SvgProps } from "react-native-svg";

/**
 * Onboarding illustrations — "Minna Bank" style: bold black-and-white, thick
 * rounded strokes, expressive characters, financial objects scattered in the
 * composition. Ported 1:1 from `unmiser Onboarding.html` to react-native-svg.
 *
 * Each illustration threads a `color` prop (defaults to the foreground ink) so
 * the archetype cards can invert the stroke colour when selected (ink card →
 * canvas-colour line work). Filled regions stay `white`/`color` explicitly so
 * the character silhouettes read on either background.
 */

type IlloProps = SvgProps & { color?: string };

/* Welcome splash — figure with arms wide, financial objects scattered */
export function WelcomeIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 270 220" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* phone top-left, slightly rotated */}
        <G transform="rotate(-12 44 54)" strokeWidth={2}>
          <Rect x={30} y={30} width={24} height={42} rx={5} />
          <Rect x={33} y={40} width={18} height={20} rx={1.5} />
          <Circle cx={42} cy={66} r={2.5} />
          <Line x1={38} y1={35} x2={46} y2={35} strokeWidth={1.5} />
        </G>
        {/* coin with rupee, top right */}
        <Circle cx={218} cy={44} r={22} strokeWidth={2} />
        <Circle cx={218} cy={44} r={14} strokeWidth={1.5} />
        <Line x1={212} y1={37} x2={224} y2={37} strokeWidth={2} />
        <Line x1={212} y1={43} x2={224} y2={43} strokeWidth={2} />
        <Line x1={212} y1={37} x2={212} y2={57} strokeWidth={2} />
        <Line x1={212} y1={43} x2={220} y2={57} strokeWidth={2} />
        {/* receipt right */}
        <Path
          d="M242 105 L242 162 Q242 165 239 165 L224 165 Q221 165 221 162 L221 105 Z"
          strokeWidth={2}
        />
        <Line x1={226} y1={116} x2={237} y2={116} strokeWidth={1.5} />
        <Line x1={226} y1={124} x2={237} y2={124} strokeWidth={1.5} />
        <Line x1={226} y1={132} x2={233} y2={132} strokeWidth={1.5} />
        <Line x1={226} y1={140} x2={237} y2={140} strokeWidth={1.5} />
        {/* coin stack bottom-left */}
        <Ellipse cx={46} cy={190} rx={19} ry={6} strokeWidth={2} />
        <Ellipse cx={46} cy={183} rx={19} ry={6} strokeWidth={2} />
        <Ellipse cx={46} cy={176} rx={19} ry={6} strokeWidth={2} />
        <Line x1={27} y1={183} x2={27} y2={190} strokeWidth={2} />
        <Line x1={65} y1={183} x2={65} y2={190} strokeWidth={2} />
        {/* bank card bottom-right */}
        <Rect x={178} y={182} width={54} height={34} rx={5} strokeWidth={2} />
        <Line x1={178} y1={196} x2={232} y2={196} strokeWidth={5} />
        <Rect x={184} y={203} width={10} height={7} rx={2} fill={ink} stroke="none" />
        {/* sparkle top */}
        <Path
          d="M148 16 L150 9 L152 16 L159 18 L152 20 L150 27 L148 20 L141 18 Z"
          strokeWidth={1.6}
        />
        {/* small star right */}
        <Path
          d="M197 172 L198 168 L199 172 L203 173 L199 174 L198 178 L197 174 L193 173 Z"
          strokeWidth={1.4}
        />
        {/* dots */}
        <Circle cx={82} cy={196} r={3.5} fill={ink} stroke="none" />
        <Circle cx={93} cy={204} r={2.5} fill={ink} stroke="none" />
        <Circle cx={168} cy={192} r={3} fill={ink} stroke="none" />

        {/* main figure */}
        <Circle cx={115} cy={56} r={23} strokeWidth={2.4} />
        <Path d="M92 52 C92 36 100 24 115 24 C130 24 138 36 138 52" strokeWidth={2.4} />
        <Path d="M92 52 C88 46 90 62 95 68" strokeWidth={2} />
        <Path d="M138 52 C142 46 140 62 136 68" strokeWidth={2} />
        <Circle cx={107} cy={52} r={2.8} fill={ink} stroke="none" />
        <Circle cx={123} cy={52} r={2.8} fill={ink} stroke="none" />
        <Path d="M106 63 C110 68 120 68 124 63" strokeWidth={2} />
        {/* body — dark filled shirt */}
        <Path
          d="M98 79 C90 82 82 98 80 124 L150 124 C148 98 140 82 132 79 C126 76 120 74 115 74 C110 74 104 76 98 79 Z"
          fill={ink}
          stroke="none"
        />
        {/* collar (canvas on dark) */}
        <Path d="M108 79 L105 90" stroke="white" strokeWidth={2.2} />
        <Path d="M122 79 L125 90" stroke="white" strokeWidth={2.2} />
        {/* left arm sweeping down-left */}
        <Path d="M84 94 C74 98 64 106 56 116" strokeWidth={2.4} />
        <Path
          d="M52 118 C50 114 52 110 56 112 C60 114 60 120 56 122 C52 124 48 122 50 118 Z"
          fill="white"
          strokeWidth={2}
        />
        {/* right arm up toward coin */}
        <Path d="M146 88 C158 80 176 68 194 58" strokeWidth={2.4} />
        <Path
          d="M196 56 C198 52 202 52 202 56 C202 60 198 62 196 60 C194 58 194 54 196 56 Z"
          fill="white"
          strokeWidth={2}
        />
        {/* pants */}
        <Path
          d="M86 124 C82 144 76 164 72 194 L96 194 C100 172 108 152 115 138 C122 152 130 172 134 194 L158 194 C154 164 148 144 144 124 Z"
          strokeWidth={2.2}
        />
        {/* shoes */}
        <Path d="M68 194 C62 194 58 198 62 201 L88 201 L88 194 Z" fill={ink} stroke="none" />
        <Path d="M142 194 L142 201 L166 201 C170 198 166 194 160 194 Z" fill={ink} stroke="none" />
      </G>
    </Svg>
  );
}

/* Archetype: The Planner — seated at tidy desk, papers, calendar */
export function PlannerIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 120 90" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <Line x1={16} y1={62} x2={88} y2={62} strokeWidth={2.4} />
        <Line x1={24} y1={62} x2={20} y2={78} strokeWidth={2.2} />
        <Line x1={80} y1={62} x2={84} y2={78} strokeWidth={2.2} />
        <Rect x={68} y={10} width={32} height={36} rx={3} strokeWidth={2} />
        <Line x1={68} y1={18} x2={100} y2={18} strokeWidth={2} />
        <Line x1={76} y1={10} x2={76} y2={14} strokeWidth={2} />
        <Line x1={92} y1={10} x2={92} y2={14} strokeWidth={2} />
        <Path d="M76 28 L78 32 L86 24" strokeWidth={2} />
        <Rect x={38} y={50} width={22} height={12} rx={1.5} strokeWidth={1.8} />
        <Line x1={41} y1={54} x2={57} y2={54} strokeWidth={1.4} />
        <Line x1={41} y1={57} x2={53} y2={57} strokeWidth={1.4} />
        <Circle cx={28} cy={24} r={12} strokeWidth={2.2} />
        <Path d="M16 24 C16 14 20 10 28 10 C36 10 40 14 40 24" strokeWidth={2.2} />
        <Circle cx={24} cy={22} r={1.8} fill={ink} stroke="none" />
        <Circle cx={32} cy={22} r={1.8} fill={ink} stroke="none" />
        <Path d="M24 28 C26 31 30 31 32 28" strokeWidth={1.8} />
        <Path d="M20 36 C16 38 14 48 14 58 L44 58 C44 50 42 40 36 36 Z" fill={ink} stroke="none" />
        <Path d="M42 42 C50 44 56 50 58 56" strokeWidth={2.2} />
        <Circle cx={59} cy={57} r={3.5} fill="white" strokeWidth={1.8} />
        <Line x1={59} y1={55} x2={66} y2={62} strokeWidth={2.2} />
      </G>
    </Svg>
  );
}

/* Archetype: The Free Spirit (spender) — walking, bag, breezy */
export function FreeSpiritIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 120 90" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M96 14 L97 10 L98 14 L102 15 L98 16 L97 20 L96 16 L92 15 Z" strokeWidth={1.4} />
        <Circle cx={18} cy={22} r={3} fill={ink} stroke="none" opacity={0.5} />
        <Circle cx={12} cy={34} r={2} fill={ink} stroke="none" opacity={0.4} />
        <Path d="M72 26 L72 48 L88 48 L88 26 Z" strokeWidth={2} />
        <Path d="M75 26 C75 20 80 18 80 18 C80 18 85 20 85 26" strokeWidth={2} />
        <Line x1={73} y1={36} x2={87} y2={36} strokeWidth={1.5} />
        <Circle cx={42} cy={18} r={12} strokeWidth={2.2} />
        <Path d="M30 16 C30 8 34 4 42 4 C50 4 54 8 54 16" strokeWidth={2.2} />
        <Path d="M54 16 C58 14 58 22 56 28" strokeWidth={2} />
        <Circle cx={38} cy={16} r={1.8} fill={ink} stroke="none" />
        <Circle cx={46} cy={16} r={1.8} fill={ink} stroke="none" />
        <Path d="M37 22 C40 26 44 26 47 22" strokeWidth={1.8} />
        <Path d="M34 30 C28 32 24 44 24 54 L56 54 C58 44 56 34 48 30 Z" fill={ink} stroke="none" />
        <Path d="M28 38 C20 38 14 44 12 50" strokeWidth={2.2} />
        <Circle cx={11} cy={52} r={3.5} fill="white" strokeWidth={1.8} />
        <Path d="M54 36 C62 32 68 30 72 30" strokeWidth={2.2} />
        <Path d="M34 54 C30 64 26 72 22 82" strokeWidth={2.2} />
        <Path d="M50 54 C56 64 62 72 68 80" strokeWidth={2.2} />
        <Path d="M18 82 C14 82 12 86 15 88 L30 88 L30 82 Z" fill={ink} stroke="none" />
        <Path d="M64 80 L64 86 L80 86 C83 84 81 80 77 80 Z" fill={ink} stroke="none" />
      </G>
    </Svg>
  );
}

/* Archetype: The Saver — cradling a large jar/piggy with a coin dropping in */
export function SaverIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 120 90" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <Path
          d="M66 26 C60 26 56 30 56 36 L56 66 C56 70 60 74 68 74 C76 74 82 70 82 66 L82 36 C82 30 78 26 72 26 Z"
          strokeWidth={2.2}
        />
        <Rect x={63} y={18} width={14} height={10} rx={3} strokeWidth={2} />
        <Line x1={67} y1={18} x2={77} y2={18} strokeWidth={3} />
        <Circle cx={70} cy={10} r={5} strokeWidth={2} />
        <Line x1={66} y1={10} x2={74} y2={10} strokeWidth={1.4} />
        <Ellipse cx={69} cy={64} rx={10} ry={5} strokeWidth={1.4} strokeDasharray="2 2" />
        <Circle cx={69} cy={52} r={6} strokeWidth={1.6} />
        <Circle cx={26} cy={22} r={12} strokeWidth={2.2} />
        <Path d="M14 22 C14 12 18 8 26 8 C34 8 38 12 38 22" strokeWidth={2.2} />
        <Circle cx={22} cy={20} r={1.8} fill={ink} stroke="none" />
        <Circle cx={30} cy={20} r={1.8} fill={ink} stroke="none" />
        <Path d="M22 27 C24 30 28 30 30 27" strokeWidth={1.8} />
        <Path d="M18 34 C14 36 12 48 12 60 L44 60 C44 50 42 38 34 34 Z" fill={ink} stroke="none" />
        <Path d="M40 40 C46 38 52 36 56 36" strokeWidth={2.2} />
        <Path d="M16 40 C10 46 8 54 8 62" strokeWidth={2.2} />
        <Path d="M18 60 C16 68 14 76 12 84" strokeWidth={2.2} />
        <Path d="M38 60 C40 68 42 76 44 84" strokeWidth={2.2} />
      </G>
    </Svg>
  );
}

/* Archetype: The Builder (investor) — standing, pointing at rising bar chart */
export function BuilderIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 120 90" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <Line x1={60} y1={78} x2={106} y2={78} strokeWidth={2} />
        <Rect x={62} y={58} width={10} height={20} strokeWidth={2} />
        <Rect x={76} y={46} width={10} height={32} strokeWidth={2} />
        <Rect x={90} y={32} width={10} height={46} fill={ink} stroke="none" opacity={0.12} />
        <Rect x={90} y={32} width={10} height={46} strokeWidth={2} />
        <Line x1={95} y1={26} x2={95} y2={14} strokeWidth={2.2} />
        <Path d="M90 20 L95 13 L100 20" strokeWidth={2.2} />
        <Circle cx={28} cy={16} r={12} strokeWidth={2.2} />
        <Path d="M16 16 C16 6 20 2 28 2 C36 2 40 6 40 16" strokeWidth={2.2} />
        <Circle cx={24} cy={14} r={1.8} fill={ink} stroke="none" />
        <Circle cx={32} cy={14} r={1.8} fill={ink} stroke="none" />
        <Path d="M24 20 C26 23 30 23 32 20" strokeWidth={1.8} />
        <Path d="M20 28 C16 30 14 42 14 54 L42 54 C42 42 40 32 36 28 Z" fill={ink} stroke="none" />
        <Path d="M40 36 C48 32 54 28 60 26" strokeWidth={2.2} />
        <Circle cx={61} cy={25} r={3.5} fill={ink} stroke="none" />
        <Path d="M16 36 C10 40 8 48 8 54" strokeWidth={2.2} />
        <Path d="M20 54 L16 80" strokeWidth={2.2} />
        <Path d="M36 54 L40 80" strokeWidth={2.2} />
        <Path d="M12 80 C8 80 6 84 10 86 L24 86 L24 80 Z" fill={ink} stroke="none" />
        <Path d="M36 80 L36 86 L50 86 C54 84 52 80 48 80 Z" fill={ink} stroke="none" />
      </G>
    </Svg>
  );
}

/* SMS screen — large phone, message bubbles, bank logos, checkmarks */
export function SmsIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 260 165" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* large phone */}
        <Rect x={86} y={12} width={88} height={142} rx={14} strokeWidth={2.4} />
        <Line x1={86} y1={42} x2={174} y2={42} strokeWidth={1.5} />
        <Line x1={86} y1={138} x2={174} y2={138} strokeWidth={1.5} />
        <Circle cx={130} cy={28} r={4} strokeWidth={1.8} />
        <Circle cx={130} cy={150} r={6} strokeWidth={1.8} />
        <Rect x={94} y={50} width={72} height={14} rx={4} fill={ink} opacity={0.06} stroke="none" />
        <Line x1={98} y1={55} x2={156} y2={55} strokeWidth={1.5} />
        <Line x1={98} y1={60} x2={144} y2={60} strokeWidth={1.5} />
        <Rect x={94} y={70} width={72} height={14} rx={4} fill={ink} opacity={0.06} stroke="none" />
        <Line x1={98} y1={75} x2={152} y2={75} strokeWidth={1.5} />
        <Line x1={98} y1={80} x2={138} y2={80} strokeWidth={1.5} />
        <Rect x={94} y={90} width={72} height={14} rx={4} fill={ink} opacity={0.06} stroke="none" />
        <Line x1={98} y1={95} x2={148} y2={95} strokeWidth={1.5} />
        <Line x1={98} y1={100} x2={136} y2={100} strokeWidth={1.5} />

        {/* SMS bubble left — bank message */}
        <Path
          d="M14 30 L14 64 Q14 68 18 68 L72 68 Q76 68 76 64 L76 30 Q76 26 72 26 L18 26 Q14 26 14 30 Z"
          fill={ink}
          stroke="none"
        />
        <Path d="M30 68 L26 76 L40 68" fill={ink} stroke="none" />
        <Line x1={20} y1={38} x2={70} y2={38} stroke="white" strokeWidth={1.8} />
        <Line x1={20} y1={46} x2={64} y2={46} stroke="white" strokeWidth={1.8} />
        <Line x1={20} y1={54} x2={58} y2={54} stroke="white" strokeWidth={1.8} />
        <Line x1={20} y1={62} x2={50} y2={62} stroke="white" strokeWidth={1.8} />

        {/* SMS bubble right — another bank */}
        <Path
          d="M184 50 L184 84 Q184 88 188 88 L242 88 Q246 88 246 84 L246 50 Q246 46 242 46 L188 46 Q184 46 184 50 Z"
          strokeWidth={2}
        />
        <Path d="M226 88 L230 96 L218 88" strokeWidth={2} />
        <Line x1={190} y1={58} x2={240} y2={58} strokeWidth={1.5} />
        <Line x1={190} y1={66} x2={232} y2={66} strokeWidth={1.5} />
        <Line x1={190} y1={74} x2={224} y2={74} strokeWidth={1.5} />

        {/* checkmark circle */}
        <Circle cx={210} cy={125} r={16} strokeWidth={2.2} />
        <Path d="M203 125 L208 131 L217 119" strokeWidth={2.4} />

        {/* bank initial dots */}
        <Circle cx={32} cy={126} r={11} strokeWidth={2} />
        <SvgText
          x={32}
          y={130}
          textAnchor="middle"
          fontSize={9}
          fill={ink}
          stroke="none"
          fontWeight="700"
          fontFamily="HankenGrotesk_700Bold"
        >
          H
        </SvgText>
        <Circle cx={58} cy={126} r={11} strokeWidth={2} />
        <SvgText
          x={58}
          y={130}
          textAnchor="middle"
          fontSize={9}
          fill={ink}
          stroke="none"
          fontWeight="700"
          fontFamily="HankenGrotesk_700Bold"
        >
          IC
        </SvgText>
        <Circle cx={84} cy={126} r={11} strokeWidth={2} />
        <SvgText
          x={84}
          y={130}
          textAnchor="middle"
          fontSize={9}
          fill={ink}
          stroke="none"
          fontWeight="700"
          fontFamily="HankenGrotesk_700Bold"
        >
          AX
        </SvgText>
      </G>
    </Svg>
  );
}

/* Done — two figures high-fiving, confetti */
export function DoneIllo({ color, ...props }: IlloProps) {
  const fg = useThemeColor("foreground");
  const ink = color ?? fg;
  return (
    <Svg viewBox="0 0 270 210" width="100%" height="100%" {...props}>
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* confetti */}
        <Circle cx={46} cy={34} r={5.5} fill={ink} stroke="none" />
        <Circle cx={76} cy={16} r={3.5} fill={ink} stroke="none" />
        <G transform="rotate(30 192 28)">
          <Rect x={188} y={24} width={9} height={9} rx={1.5} fill={ink} stroke="none" />
        </G>
        <G transform="rotate(-22 65 177)">
          <Rect x={62} y={174} width={7} height={7} rx={1.5} fill={ink} stroke="none" />
        </G>
        <Circle cx={214} cy={50} r={5} fill={ink} stroke="none" />
        <Circle cx={226} cy={76} r={3.5} fill={ink} stroke="none" opacity={0.5} />
        <Circle cx={34} cy={110} r={4} fill={ink} stroke="none" opacity={0.4} />
        <Circle cx={240} cy={140} r={3.5} fill={ink} stroke="none" opacity={0.5} />
        <G transform="rotate(15 111 11)">
          <Rect x={108} y={8} width={7} height={7} rx={1} fill={ink} stroke="none" />
        </G>
        <G transform="rotate(-10 151 13)">
          <Rect x={148} y={10} width={6} height={6} rx={1} fill={ink} stroke="none" />
        </G>
        {/* star burst top center */}
        <Path
          d="M135 20 L137 13 L139 20 L146 22 L139 24 L137 31 L135 24 L128 22 Z"
          strokeWidth={1.8}
        />

        {/* left figure */}
        <Circle cx={78} cy={62} r={21} strokeWidth={2.4} />
        <Path d="M57 58 C57 42 65 32 78 32 C91 32 99 42 99 58" strokeWidth={2.4} />
        <Path d="M57 58 C53 52 55 66 60 72" strokeWidth={2} />
        <Path d="M70 58 C72 55 75 55 77 58" strokeWidth={2} />
        <Path d="M79 58 C81 55 84 55 86 58" strokeWidth={2} />
        <Path d="M70 68 C74 74 82 74 86 68" strokeWidth={2.2} />
        <Path
          d="M64 83 C56 86 50 100 48 122 L108 122 C106 100 100 88 92 83 C87 80 82 78 78 78 C74 78 69 80 64 83 Z"
          fill={ink}
          stroke="none"
        />
        <Path d="M74 83 L71 93" stroke="white" strokeWidth={2} />
        <Path d="M82 83 L85 93" stroke="white" strokeWidth={2} />
        <Path d="M54 94 C46 82 40 70 38 56" strokeWidth={2.4} />
        <Ellipse cx={38} cy={54} rx={5} ry={4} fill="white" strokeWidth={2} />
        <Path d="M104 92 C114 84 122 78 132 74" strokeWidth={2.4} />
        <Path d="M62 122 C56 142 50 162 46 192" strokeWidth={2.2} />
        <Path d="M94 122 C100 142 106 162 110 192" strokeWidth={2.2} />
        <Path d="M40 192 C34 192 30 196 34 199 L58 199 L58 192 Z" fill={ink} stroke="none" />
        <Path d="M106 192 L106 199 L132 199 C136 196 132 192 126 192 Z" fill={ink} stroke="none" />

        {/* high-five contact */}
        <Path d="M132 72 C136 66 138 62 136 58" strokeWidth={2.2} />
        <Circle cx={136} cy={56} r={5} fill={ink} stroke="none" />

        {/* right figure (striped shirt) */}
        <Circle cx={192} cy={62} r={20} strokeWidth={2.4} />
        <Path d="M172 58 C172 44 180 34 192 34 C204 34 212 44 212 58" strokeWidth={2.4} />
        <Path d="M212 58 C216 52 214 66 210 72" strokeWidth={2} />
        <Path d="M184 58 C186 55 189 55 191 58" strokeWidth={2} />
        <Path d="M193 58 C195 55 198 55 200 58" strokeWidth={2} />
        <Path d="M184 68 C188 74 196 74 200 68" strokeWidth={2.2} />
        <Path
          d="M178 83 C172 86 166 100 164 122 L220 122 C218 100 212 86 206 83 Z"
          strokeWidth={2.2}
        />
        <Line x1={164} y1={96} x2={220} y2={96} strokeWidth={1.8} />
        <Line x1={164} y1={108} x2={220} y2={108} strokeWidth={1.8} />
        <Path d="M168 90 C158 84 148 78 140 74" strokeWidth={2.4} />
        <Path d="M216 90 C224 80 230 68 234 56" strokeWidth={2.4} />
        <Ellipse cx={234} cy={54} rx={5} ry={4} fill="white" strokeWidth={2} />
        <Path d="M174 122 C170 142 164 164 160 192" strokeWidth={2.2} />
        <Path d="M206 122 C210 142 218 164 222 192" strokeWidth={2.2} />
        <Path d="M154 192 C148 192 144 196 148 199 L172 199 L172 192 Z" fill={ink} stroke="none" />
        <Path d="M218 192 L218 199 L244 199 C248 196 244 192 238 192 Z" fill={ink} stroke="none" />
      </G>
    </Svg>
  );
}

/** Picks the card illustration for a given archetype id. */
export function archetypeCardIllo(id: string) {
  switch (id) {
    case "planner":
      return PlannerIllo;
    case "saver":
      return SaverIllo;
    case "spender":
      return FreeSpiritIllo;
    case "investor":
      return BuilderIllo;
    default:
      return PlannerIllo;
  }
}
