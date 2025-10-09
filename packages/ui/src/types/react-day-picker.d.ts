declare module 'react-day-picker' {
  import * as React from 'react'

  export type DayModifiers = {
    selected?: boolean
    range_start?: boolean
    range_end?: boolean
    range_middle?: boolean
    outside?: boolean
    focused?: boolean
  }

  export type DayButton = React.ComponentType<any>

  export type DateValue = Date | undefined

  export interface DayPickerProps extends React.HTMLAttributes<HTMLElement> {
    showOutsideDays?: boolean
    className?: string
    captionLayout?: 'label' | 'dropdown'
    formatters?: Record<string, any>
    classNames?: Record<string, string>
    components?: Record<string, any>
    onSelect?: (date?: Date) => void
    selected?: Date | undefined
    mode?: 'single' | 'range'
    fromDate?: Date
    toDate?: Date
    fromYear?: number
    toYear?: number
  }

  export const DayPicker: React.FC<DayPickerProps>
  export const getDefaultClassNames: () => Record<string, string>
  export const DayButton: any
  export default DayPicker
}
