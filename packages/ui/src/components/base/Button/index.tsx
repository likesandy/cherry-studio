import { Button as HeroUIButton } from '@heroui/react'

export type ButtonProps = React.ComponentProps<typeof HeroUIButton>

const Button = ({ ...props }: ButtonProps) => {
  return <HeroUIButton {...props} />
}

Button.displayName = 'Button'

export default Button
