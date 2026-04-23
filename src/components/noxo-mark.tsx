import type { SVGProps } from "react"

type NoxoMarkProps = SVGProps<SVGSVGElement> & {
  title?: string
}

export function NoxoMark({ title = "Noxo logo", ...props }: NoxoMarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="60" cy="60" r="55" fill="#E6F1FB" />
      <circle cx="60" cy="60" r="44" fill="#D0E6F8" />
      <circle cx="60" cy="60" r="33" fill="#B5D4F4" />
      <circle cx="60" cy="60" r="55" fill="none" stroke="#378ADD" strokeWidth="0.8" opacity="0.4" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="#378ADD" strokeWidth="0.5" opacity="0.25" />
      <line x1="31" y1="31" x2="89" y2="89" stroke="#85B7EB" strokeWidth="13" strokeLinecap="round" />
      <line x1="89" y1="31" x2="31" y2="89" stroke="#85B7EB" strokeWidth="13" strokeLinecap="round" />
      <line x1="30" y1="30" x2="90" y2="90" stroke="#185FA5" strokeWidth="9" strokeLinecap="round" />
      <line x1="90" y1="30" x2="30" y2="90" stroke="#185FA5" strokeWidth="9" strokeLinecap="round" />
      <circle cx="30" cy="30" r="7" fill="#E6F1FB" />
      <circle cx="30" cy="30" r="4.5" fill="#185FA5" />
      <circle cx="90" cy="30" r="7" fill="#E6F1FB" />
      <circle cx="90" cy="30" r="4.5" fill="#185FA5" />
      <circle cx="30" cy="90" r="7" fill="#E6F1FB" />
      <circle cx="30" cy="90" r="4.5" fill="#185FA5" />
      <circle cx="90" cy="90" r="7" fill="#E6F1FB" />
      <circle cx="90" cy="90" r="4.5" fill="#185FA5" />
      <circle cx="60" cy="60" r="11" fill="#E6F1FB" />
      <circle cx="60" cy="60" r="8" fill="#E1F5EE" />
      <circle cx="60" cy="60" r="5" fill="#1D9E75" />
      <circle cx="60" cy="60" r="2.5" fill="#E1F5EE" />
    </svg>
  )
}
