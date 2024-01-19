import React from 'react'
import {isWeb} from 'platform/detection'

const onAuxClick = (
  e: React.MouseEvent<HTMLDivElement, MouseEvent> & {target: HTMLElement},
) => {
  // Only handle the middle mouse button click
  // Only handle if the clicked element itself or one of its ancestors is a link
  if (e.button !== 1 || e.target.closest('a') || e.target.tagName === 'A') {
    return
  }

  // On the original element, trigger a click event with metaKey set to true so that it triggers
  // the browser's default behavior of opening the link in a new tab
  e.target.dispatchEvent(
    new MouseEvent('click', {metaKey: true, bubbles: true}),
  )
}

export function WebAuxClickWrapper({children}: {children: React.ReactNode}) {
  if (!isWeb) return children

  return <div onAuxClick={onAuxClick}>{children}</div>
}
