import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: ["./src/**/*.{ts,tsx}"],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-switzer)',
  				'var(--font-geist-sans)',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			h1: [
  				'8.000rem',
  				{
  					lineHeight: '0.9',
  					letterSpacing: '-0.02em'
  				}
  			],
  			h2: [
  				'5.625rem',
  				{
  					lineHeight: '1',
  					letterSpacing: '-0.01em'
  				}
  			],
  			h3: [
  				'4rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '-0.01em'
  				}
  			],
  			h4: [
  				'2.812rem',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '0'
  				}
  			],
  			h5: [
  				'2rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '0'
  				}
  			],
  			h6: [
  				'1.438rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '0'
  				}
  			],
  			body: [
  				'1rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '0'
  				}
  			],
  			small: [
  				'0.875rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '0'
  				}
  			],
  			button: [
  				'0.875rem',
  				{
  					lineHeight: '1',
  					letterSpacing: '0'
  				}
  			],
  			micro: [
  				'0.75rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '0'
  				}
  			]
  		},
		colors: {
			border: 'hsl(var(--border))',
			input: 'hsl(var(--input))',
			ring: 'hsl(var(--ring))',
			background: 'hsl(var(--background))',
			foreground: 'hsl(var(--foreground))',
			primary: {
				DEFAULT: 'hsl(var(--primary))',
				foreground: 'hsl(var(--primary-foreground))'
			},
			destructive: {
				DEFAULT: 'hsl(var(--destructive))',
				foreground: 'hsl(var(--destructive-foreground))'
			},
			popover: {
				DEFAULT: 'hsl(var(--popover))',
				foreground: 'hsl(var(--popover-foreground))'
			},
			card: {
				DEFAULT: 'hsl(var(--card))',
				foreground: 'hsl(var(--card-foreground))'
			}
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
