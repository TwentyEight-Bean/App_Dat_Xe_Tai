import { useEffect, useRef } from "react"

// Used only by customer dialogs. Shared driver overlays keep their behavior.
export default function useCustomerDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const ancestors: HTMLElement[] = []
    for (
      let element = dialog.parentElement;
      element;
      element = element.parentElement
    )
      ancestors.push(element)
    const overflowBefore = ancestors.map((element) => element.style.overflow)
    ancestors.forEach((element) => {
      element.style.overflow = "hidden"
    })
    const previous = document.activeElement as HTMLElement | null
    const root = document.querySelector<HTMLElement>(".customer-frame")
    const siblings: Element[] = root
      ? [...root.children].filter((el) => !el.contains(dialog))
      : []
    const roleSwitch = document.querySelector(".role-switch")
    if (roleSwitch) siblings.push(roleSwitch)
    const inertBefore = siblings.map((el) => (el as HTMLElement).inert)
    siblings.forEach((el) => {
      ;(el as HTMLElement).inert = true
    })
    const controls = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0)
    ;(
      controls().find((el) => el.tagName === "INPUT") ||
      controls()[0] ||
      dialog
    ).focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== "Tab") return
      const items = controls()
      const first = items[0] || dialog
      const last = items[items.length - 1] || dialog
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.removeEventListener("keydown", keydown)
      ancestors.forEach((element, index) => {
        element.style.overflow = overflowBefore[index]
      })
      siblings.forEach((el, index) => {
        ;(el as HTMLElement).inert = inertBefore[index]
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [open])
  return ref
}
