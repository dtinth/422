import React, { Component } from 'react'

import _ from 'lodash'
import chroma from 'chroma-js'

// NOTE: VERY HACKY CODE. YOU HAVE BEEN WARNED.

/* eslint import/no-webpack-loader-syntax: off */

const Chance = require('chance').Chance
const chance = new Chance(12345)
const THREE = require('three')
require('ccapture.js')

var capturer = window.cap = new window.CCapture({ format: 'png', framerate: 60, motionBlurFrames: 240 / 30, timeLimit: 124, display: true })

function nn (i, j) {
  const n = Math.max(Math.abs(i), Math.abs(j))
  return 14 + 4 * n * n + (j > i ? -1 : 1) * (2 * n - i - j)
}
window.nn = nn
const MIDIFile = require('midifile')
const MIDIEvents = require('midievents')

const notes = (() => {
  const midi = new MIDIFile(require('!!arraybuffer-loader!./piano.mid'))
  const notes = [ ]
  for (const event of midi.getMidiEvents()) {
    if (event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON) {
      const note = event.param1
      const v = event.param2
      const velocity = Math.pow(v / 127, 2)
      const time = event.playTime
      notes.push({ time, note, velocity })
    }
  }
  window.notes = notes
  return notes
})()

function getNotes (f) {
  const midi = new MIDIFile(f)
  const notes = [ ]
  for (const event of midi.getMidiEvents()) {
    if (event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON) {
      const note = event.param1
      const time = event.playTime
      notes.push({ time, note })
    }
  }
  return notes
}

const kicks = window.kicks = getNotes(require('!!arraybuffer-loader!./kick.mid'))
const vox = window.vox = getNotes(require('!!arraybuffer-loader!./vox.mid'))

const lyrics = [
  [ 8, 12, 'Ev|ery |time |that |I |see |you...' ],
  [ 16, 20, 'Ev|ery |time |that |I |see |you...' ],
  [ 40, 44, 'I |don\'t |know |what |to |say...' ],
  [ 44, 48, 'I |don\'t |know |what |to |think...' ],
  [ 48, 51, 'What |made |me |feel |this |way?' ],
  [ 51, 55, 'What |is |go|ing |on??' ],
  [ 55, 57, 'My |mind?!?' ],
  [ 57, 58, 'Ohh..!!?' ],
  [ 58, 62, 'Ev|ery |time |that |I |see |you' ],
  [ 62, 64.875, 'Can|not |pro|cess |that |fee|ling' ],
  [ 66, 70, 'Do |not |know |what |to |do' ],
  [ 70, 73.5, 'Four-|hun|dred-|twen|ty-|two...' ],
]

const _W = 256
const _H = 256

class App extends Component {
  componentDidMount () {
    const el = this.el
    if (!el) return

    const canvas = document.createElement('canvas')
    const ctx = window.ctx = canvas.getContext('2d')
    canvas.className = 'canvas'
    canvas.width = _W
    canvas.height = _H

    const notesByTime = _.mapValues(
      _.groupBy(notes, 'note'),
      a => _.sortBy(a, 'time')
    )

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, _W/_H, 1, 10000)
    camera.position.x = 0
    camera.position.y = 256
    camera.position.z = 0
    camera.lookAt(new THREE.Vector3())

    const material = new THREE.MeshBasicMaterial({ color: 0x000000,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })

    function box (i, j) {
      const note = nn(i, j)
      const [ r, g, b ] = chroma.hsl((note % 12) * 30, 0.8, 0.7).rgb()
      const color = r * 0x10000 + g * 0x100 + b
      const wireframeMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 })

      const geometry = new THREE.BoxGeometry(32, 32, 32)

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.x = i * 32
      mesh.position.z = j * 32
      scene.add(mesh)

      const edges = new THREE.EdgesGeometry(mesh.geometry)
      const wireframe = new THREE.LineSegments(edges, wireframeMaterial)
      mesh.add(wireframe)
      return {
        i,
        j,
        scale: (v) => { mesh.scale.y = v },
        dance: (v, t) => {
          const theta = t
          const rho = 8 + (1 + Math.sin(t * 2))
          const xi = Math.sin(theta) * rho
          const xj = Math.cos(theta) * rho
          const ripple = Math.sin(Math.hypot(i - xi, j - xj) + 2 * t)
          mesh.position.y = v * ripple * 16
        }
      }
    }
    function auxbox (i) {
      const color = 0x555453
      const wireframeMaterial = new THREE.LineBasicMaterial({ color, linewidth: 2 })

      const geometry = new THREE.BoxGeometry(32, 32, 32)
      const sy = chance.floating({ min: -1000, max: 1000 })
      const vy = chance.floating({ min: 20, max: 200 })
      const rx = chance.floating({ min: -1, max: 1 })
      const ry = chance.floating({ min: -1, max: 1 })
      const rz = chance.floating({ min: -1, max: 1 })

      const mesh = new THREE.Mesh(geometry, material)
      const rho = chance.floating({ min: 512, max: 576 })
      mesh.position.x = Math.cos(i * Math.PI * 2) * rho
      mesh.position.z = Math.sin(i * Math.PI * 2) * rho
      scene.add(mesh)

      const edges = new THREE.EdgesGeometry(mesh.geometry)
      const wireframe = new THREE.LineSegments(edges, wireframeMaterial)
      mesh.add(wireframe)
      return {
        update (time) {
          const t = time / 1000
          const tt = 10000
            + t
            - Math.exp(2 * Math.min(0, t - 60 / 188 * 24 * 4)) * 12
          mesh.position.y = -1 * ((sy + vy * tt + 1024) % 4096) + 1024
          mesh.rotation.x = rx * t
          mesh.rotation.y = ry * t
          mesh.rotation.z = rz * t
        }
      }
    }

    let boxes = [ ]
    let auxboxes = [ ]

    for (let i = -5; i <= 5; i++) {
      for (let j = -5; j <= 5; j++) {
        boxes.push(box(i, j))
      }
    }

    for (let i = 0; i < 512; i++) auxboxes.push(auxbox(i / 512))

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(_W, _H)

    const f = () => {
      const elapsed = this.audio.currentTime
      const theta = elapsed / -5 - 2 + Math.PI
      const time = elapsed * 1000 - 900
      const intensity = _.sumBy(kicks, k => (
        time >= k.time ? (
          Math.exp((k.time - time) / 128)
        ) : (
          0
        )
      ))

      void (() => {
        const m = Math.max(0, elapsed - 0.25)
        const rho = (300 - Math.sin(elapsed / 3) * 40) * (1 - Math.exp(-m / 3))
        camera.position.x = Math.sin(theta) * rho
        camera.position.y = 32 + 192 * (1 - Math.exp(-m))
        camera.position.z = Math.cos(theta) * -rho
        camera.lookAt(new THREE.Vector3())
      })()
      boxes.forEach((b) => {
        const note = nn(b.i, b.j)
        const a = notesByTime[note] || []
        const index = _.sortedIndexBy(a, { time }, 'time') - 1
        const c = 1 + _.max(_.map(_.range(index, index - 8), i =>
          i >= 0 && a[i] && time >= a[i].time ? (
            Math.exp((a[i].time - time) / 500) * a[i].velocity * 24
          ) : (
            0
          )
        ))
        b.scale(c)
        b.dance(intensity, elapsed)
      })
      auxboxes.forEach(b => b.update(time))
      renderer.render(scene, camera)
      ctx.drawImage(renderer.domElement, 0, 0)
      overlay(time)
      capturer.capture(canvas)
      window.requestAnimationFrame(f)
    }

    const font = (() => {
      {
        ctx.font = '16px Windows Command Prompt'
        const w = ctx.measureText('Every time that I see you').width
        if (w === 159) return { size: 16, family: 'Windows Command Prompt', weight: 400 }
      }
      return { size: 12, family: 'Courier New', weight: 600 }
    })()
    const titleText = (sz, target, text, yoff = 0, color = 'white') => {
      const setFont = () => {
        ctx.font = `${font.weight} ${sz / 16 * font.size}px ${font.family}, PixelMPlus10`
      }
      setFont()
      const data = text.split('').map(c => ({ c, w: ctx.measureText(c).width }))
      const startX = Math.round((_W - data.reduce((a, b) => a + b.w, 0)) / 2)
      return {
        draw (time) {
          if (time < target) return
          if (time > target + 8000) return
          setFont()
          ctx.fillStyle = 'white'
          let x = startX
          for (let i = 0; i < data.length; i++) {
            const { c, w } = data[i]
            const dx = Math.round(
              time < target + 5000 ? (
                256 * Math.pow(1 - Math.min(1, (time - (target + 64 * i)) / 512), 2)
              ) : (
                -256 * Math.pow(Math.max(0, (time - (target + 64 * i + 5000)) / 512), 2)
              )
            )
            ctx.fillStyle = 'black'
            ctx.fillText(c, x + dx + 1, 256 - 16 + 1 + yoff)
            ctx.fillStyle = color
            ctx.fillText(c, x + dx, 256 - 16 + yoff)
            x += w
          }
        }
      }
    }
    const lyricText = (start, end, characters) => {
      const setFont = () => {
        ctx.font = `${font.weight} ${font.size}px ${font.family}`
      }
      setFont()
      const widths = characters.map(({ c }) => (ctx.measureText(c).width))
      const startX = Math.round((256 - widths.reduce((a, b) => a + b, 0)) / 2)
      return {
        draw (time) {
          if (time < start) return
          if (time > end + 2000) return
          setFont()
          let cx = startX
          for (let i = 0; i < characters.length; i++) {
            const { c, note } = characters[i]
            const w = widths[i]
            if (c !== ' ') {
              let x = cx
              let y = 24
              const inTarget = start + 64 * i
              if (time >= inTarget) {
                if (time > end) {
                  const over = (time - end) / 1000
                  const theta = 2 + i * 0.5
                  x += Math.cos(theta) * over * 256
                  y += Math.sin(theta) * over * 256 + over * over * 512
                }
                const d = Math.exp((inTarget - time) / 200)
                ctx.fillStyle = 'black'
                ctx.fillText(c, x + 1, y + 1)
                ctx.fillStyle = chroma.hsl((note % 12) * 30, 1, 0.8 + 0.2 * (1 - Math.pow(1 - d, 3))).hex()
                ctx.fillText(c, x, y)
              }
            }
            cx += w
          }
        }
      }
    }

    const titleTexts = [
      titleText(16, 0, '#BMS_Shuin', -22, '#ff5457'),
      titleText('20', 0, 'ピアノの党', 0),
      titleText(32, 5106, '422', -16),
      titleText(16, 5106, 'composed: flicknote'),
      titleText(16, 10212, 'vocals: MindaRyn'),
      // titleText(32, 40000, '422', -16 - 96),
      // titleText(16, 40000, 'composed: flicknote', 0 - 96),
      // titleText(16, 40000, 'vocals: MindaRyn', 16 - 96),
      titleText(16, 116100, 'bga: flicknote')
    ]

    const lyricsText = lyrics.map(([ start, end, text ]) => {
      const characters = [ ]
      for (const syllable of text.split('|')) {
        const note = vox.shift().note
        characters.push(...syllable.split('').map(c => ({ c, note })))
      }
      const t = v => v * 4 * (60 / 188) * 1000
      return lyricText(t(start), t(end), characters)
    })

    const overlay = (time) => {
      for (const t of titleTexts) t.draw(time)
      for (const t of lyricsText) t.draw(time)
      if (time > 121000) {
        const opacity = (1 - Math.max(0, (123000 - time) / 2000)).toFixed(3)
        ctx.fillStyle = `rgba(0,0,0,${opacity})`
        ctx.fillRect(0,0,256,256)
      }
    }

    window.requestAnimationFrame(f)

    el.appendChild(canvas)
  }
  render () {
    return (
      <div className='main'>
        <div className='info'>
          <h1>422</h1>
          <p>Please use Google Chrome to open this page.</p>
          <p>
            Composed by <strong>flicknote</strong> <span className='real'>(Thai Pangsakulyanont)</span>
            <br />
            Vocals by <strong>MindaRyn</strong> <span className='real'>(Natcha Pongsupanee)</span>
            <br />
            Visualized by <strong>flicknote</strong> <span className='real'>(Thai Pangsakulyanont)</span>
          </p>
          <p>
            <a href='https://www.youtube.com/watch?v=gGIVlAwr-m8'>View on YouTube</a>
            {' '}&middot;{' '}
            <a href='http://qstol.info/events/venue/detail?event=3&id=42'>Download BMS</a>
          </p>
          <p>
            <a href='https://github.com/dtinth/422'>Source code on GitHub</a>
          </p>
        </div>
        <div className='view'>
          <audio
            className='audio'
            ref={el => (this.audio = el)}
            src={require('./422b.ogg')}
            controls
          />
          <div ref={el => (this.el = el)} />
        </div>
      </div>
    )
  }
}

export default App
