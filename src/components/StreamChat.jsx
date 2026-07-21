import { useEffect, useRef } from 'react'
import { hash01 } from '../game/util.js'

const USER_COLORS = ['#ff2d78', '#2de2e6', '#ffce4f', '#4fe07d', '#b28dff', '#ff9f45', '#6ec6ff']

/**
 * Live chat playback for a streamed match. Shows comments whose `at` index
 * has been revealed (comments react to lines the viewer has already seen).
 */
export default function StreamChat({ stream, revealed }) {
  const boxRef = useRef(null)
  const visible = stream.comments.filter((c) => c.at <= revealed - 1)

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [visible.length])

  return (
    <div className="chatpanel">
      <div className="row spread" style={{ marginBottom: 4 }}>
        <span className="small dim">stream chat</span>
        <span className="small pink">👁 {stream.viewers} watching</span>
      </div>
      <div className="chatbox" ref={boxRef}>
        {stream.viewers === 0 && <p className="dim small">Nobody is watching. The void does not comment.</p>}
        {stream.viewers > 0 && visible.length === 0 && <p className="dim small">chat is waiting…</p>}
        {visible.map((c, i) => (
          <div className="chatline" key={i}>
            <span className="chatuser" style={{ color: USER_COLORS[Math.floor(hash01(c.user) * USER_COLORS.length)] }}>
              {c.user}
            </span>
            : {c.text}
          </div>
        ))}
      </div>
    </div>
  )
}
