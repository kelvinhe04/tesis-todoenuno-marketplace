import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="20" y1="20" x2="15.3" y2="15.3" />
  </svg>
)

export const IconCart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 4h2.2l.8 3M6 7h13.4l-1.7 7H8.2L6 7z" />
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </svg>
)

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.2" r="3.6" />
    <path d="M4.6 19.5c0-3.6 3.3-5.8 7.4-5.8s7.4 2.2 7.4 5.8" />
  </svg>
)

export const IconStar = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <path
      d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
)

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.2" />
    <circle cx="8.2" cy="9.5" r="1.7" />
    <path d="M3.5 16.5l5-5 3.2 3.2 3-3 5.3 5.3" />
  </svg>
)

export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15.5 4.5l4 4L8 20H4v-4z" />
  </svg>
)

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M18 7l-.8 12a1.5 1.5 0 0 1-1.5 1.4H8.3A1.5 1.5 0 0 1 6.8 19L6 7" />
  </svg>
)

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
    <polyline points="15 16 20 12 15 8" />
    <line x1="20" y1="12" x2="9" y2="12" />
  </svg>
)

export const IconDashboard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" />
    <rect x="13" y="3.5" width="7.5" height="7.5" />
    <rect x="3.5" y="13" width="7.5" height="7.5" />
    <rect x="13" y="13" width="7.5" height="7.5" />
  </svg>
)

export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="4" />
    <rect x="3.5" y="10" width="17" height="4" />
    <rect x="3.5" y="15.5" width="17" height="4" />
  </svg>
)

export const IconOrders = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3.5h9l3 3v14H6z" />
    <line x1="9" y1="9" x2="15" y2="9" />
    <line x1="9" y1="13" x2="15" y2="13" />
  </svg>
)

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 14, height: 14, ...p })}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 18, height: 18, ...p })}>
    <polyline points="15 6 9 12 15 18" />
  </svg>
)

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 18, height: 18, ...p })}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
)

export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
)

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </svg>
)

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z" />
    <path d="M10 18.5a2 2 0 0 0 4 0" />
  </svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
)

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 11.5L12 4l8 7.5" />
    <path d="M6 10v9.5h12V10" />
  </svg>
)

export const IconShirt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z" />
  </svg>
)

export const IconCpu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.5 5.5L8 8M16 16l2.5 2.5M18.5 5.5L16 8M8 16l-2.5 2.5" />
  </svg>
)

export const IconWrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14.5 6.5a4 4 0 0 1-5.4 5.4L4 17l3 3 5.1-5.1a4 4 0 0 1 5.4-5.4L15 12l-2.5-2.5z" />
  </svg>
)

export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
  </svg>
)

export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconEyeOff = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.7 4.6M6.7 6.7C4.2 8.3 2 12 2 12s3.6 7 10 7a10.2 10.2 0 0 0 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)
