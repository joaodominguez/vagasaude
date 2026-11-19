import {
  Baby,
  Apple,
  Brain,
  BriefcaseMedical,
  ClipboardList,
  FlaskConical,
  Glasses,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Landmark,
  MessageCircleHeart,
  PawPrint,
  PersonStanding,
  Pill,
  Smile,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Infermieristica: HeartPulse,
  Medicina: Stethoscope,
  OSS: HandHeart,
  Fisioterapia: PersonStanding,
  "Tecnici sanitari": FlaskConical,
  Ostetricia: Baby,
  Farmacia: Pill,
  Psicologia: Brain,
  "Nutrizione e dietistica": Apple,
  Odontoiatria: Smile,
  "Logopedia e riabilitazione": MessageCircleHeart,
  "Ottica e audiometria": Glasses,
  Veterinaria: PawPrint,
  "Servizio sociale": HeartHandshake,
  "Gestione e supporto": ClipboardList,
  Amministrativo: ClipboardList,
};

/**
 * Icona della professione (la stessa nella scheda e in cima alla pagina dell'offerta).
 * `concorso` usa l'icona istituzionale, come nelle maquette, per i bandi pubblici.
 */
export function JobIcon({
  profession,
  concorso = false,
  large = false,
}: {
  profession: string;
  concorso?: boolean;
  large?: boolean;
}) {
  const Icon = concorso ? Landmark : (ICONS[profession] ?? BriefcaseMedical);
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-primary-soft text-primary ${
        large ? "h-12 w-12 rounded-2xl sm:h-14 sm:w-14" : "h-11 w-11 rounded-xl"
      }`}
    >
      <Icon size={large ? 26 : 22} strokeWidth={large ? 1.7 : 1.8} aria-hidden="true" />
    </span>
  );
}

export function professionIcon(profession: string): LucideIcon {
  return ICONS[profession] ?? BriefcaseMedical;
}
