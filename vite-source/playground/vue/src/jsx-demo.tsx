export type LabelProps = {
  text: string
}

export function createLabel(props: LabelProps) {
  return <span className="tsx-label">{props.text}</span>
}
