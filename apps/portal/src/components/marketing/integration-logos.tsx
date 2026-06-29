import { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & { size?: number };

function LogoWrapper({ children, size = 24, ...props }: LogoProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {children}
    </svg>
  );
}

export function OpenAILogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </LogoWrapper>
  );
}

export function AnthropicLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 4L10 20H14L18 4H15L12 14L9 4H6Z" fill="currentColor"/>
    </LogoWrapper>
  );
}

export function GeminiLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 10 8 8 11C6 14 2 16 2 16C2 16 6 18 8 21C10 24 12 22 12 22C12 22 14 24 16 21C18 18 22 16 22 16C22 16 18 14 16 11C14 8 12 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </LogoWrapper>
  );
}

export function OllamaLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="15" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="9" cy="13" r="1" fill="currentColor"/>
      <circle cx="15" cy="13" r="1" fill="currentColor"/>
      <path d="M12 10V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 5C10 5 11 3 12 3C13 3 14 5 14 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function GroqLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function MistralLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 4L8 4L8 20L4 20L4 4Z" fill="currentColor" opacity="0.6"/>
      <path d="M10 4L14 4L14 20L10 20L10 4Z" fill="currentColor" opacity="0.8"/>
      <path d="M16 4L20 4L20 20L16 20L16 4Z" fill="currentColor"/>
    </LogoWrapper>
  );
}

export function PineconeLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15 9H9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 10V22" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function ChromaDBLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 9H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 13H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 17H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function WeaviateLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 20L7 4H10L12 14L14 4H17L21 20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </LogoWrapper>
  );
}

export function QdrantLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 4V20" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 12H20" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </LogoWrapper>
  );
}

export function MilvusLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20L12 4L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 9H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function FAISSLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 7H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 17H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function PythonLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9 2 9 3.5 9 4.5V7H15V8.5H7C5.5 8.5 4 10 4 13C4 16 5.5 17 7 17H9V14.5C9 13 10.5 12 12 12H15C16.5 12 17 11 17 9.5V7C17 5.5 16 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 4C8.5 4 8 3.5 8 3C8 2.5 8.5 2 9 2C9.5 2 10 2.5 10 3C10 3.5 9.5 4 9 4Z" fill="currentColor"/>
      <path d="M12 22C15 22 15 20.5 15 19.5V17H9V15.5H17C18.5 15.5 20 14 20 11C20 8 18.5 7 17 7H15V9.5C15 11 13.5 12 12 12H9C7.5 12 7 13 7 14.5V17C7 18.5 8 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M15 20C15.5 20 16 20.5 16 21C16 21.5 15.5 22 15 22C14.5 22 14 21.5 14 21C14 20.5 14.5 20 15 20Z" fill="currentColor"/>
    </LogoWrapper>
  );
}

export function TypeScriptLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 12H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 12V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 19V14.5C14 13.5 15 13 16 13C17 13 18 13.5 18 14.5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 16H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}

export function GoLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 9L4 12L8 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 9L20 12L16 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </LogoWrapper>
  );
}

export function JavaLogo({ size }: LogoProps) {
  return (
    <LogoWrapper size={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 4C8 4 15 3 19 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6 8C6 8 15 5 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 12C5 12 15 9 21 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 16L10 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 16L14 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </LogoWrapper>
  );
}
