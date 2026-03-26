// pages/api/og.js — generates the OG image as a real PNG via @vercel/og
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f0e17 0%, #1a1a2e 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
          background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
          display: 'flex',
        }} />

        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-60px',
          width: '380px', height: '380px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '52px 80px 0',
        }}>
          {/* Icon */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px',
          }}>🎓</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: '22px', fontWeight: 700 }}>SRM Portal</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>srm-campus-hub.vercel.app</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '12px',
          padding: '44px 80px 0',
          flex: 1,
        }}>
          <div style={{
            display: 'flex',
            color: 'white',
            fontSize: '68px',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-2px',
          }}>
            Works on WiFi +
          </div>
          <div style={{
            display: 'flex',
            background: 'linear-gradient(90deg, #818cf8, #60a5fa)',
            backgroundClip: 'text',
            color: 'transparent',
            fontSize: '68px',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-2px',
          }}>
            Mobile Data
          </div>
          <div style={{
            display: 'flex',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '24px',
            fontWeight: 400,
            marginTop: '8px',
          }}>
            Your SRM academics, finally clear.
          </div>
        </div>

        {/* Feature cards row */}
        <div style={{ display: 'flex', gap: '16px', padding: '28px 80px 52px' }}>

          {/* Attendance card */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            flex: 1, padding: '18px 20px', borderRadius: '16px',
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Attendance</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[['Math', '90%', '#4ade80'], ['DBMS', '72%', '#facc15'], ['AI', '58%', '#f87171']].map(([sub, pct, col]) => (
                <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', width: '36px' }}>{sub}</span>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', display: 'flex' }}>
                    <div style={{ width: pct, height: '6px', borderRadius: '3px', background: col }} />
                  </div>
                  <span style={{ color: col, fontSize: '12px', fontWeight: 700, width: '34px' }}>{pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Marks card */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            flex: 1, padding: '18px 20px', borderRadius: '16px',
            background: 'rgba(59,130,246,0.10)',
            border: '1px solid rgba(59,130,246,0.28)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📝</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Marks</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[['Cycle 1', '24/25', '#4ade80'], ['Cycle 2', '19/25', '#facc15'], ['Model', '61/75', '#60a5fa']].map(([label, score, col]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>{label}</span>
                  <span style={{ color: col, fontSize: '13px', fontWeight: 700, background: `${col}22`, padding: '2px 10px', borderRadius: '6px' }}>{score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timetable card */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            flex: 1, padding: '18px 20px', borderRadius: '16px',
            background: 'rgba(139,92,246,0.10)',
            border: '1px solid rgba(139,92,246,0.28)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🗓️</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Timetable</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[['08:00', 'Mathematics', 'A'], ['09:55', 'AI & ML', 'F'], ['11:50', 'DBMS Lab', 'P5']].map(([time, sub, slot]) => (
                <div key={time} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', width: '36px' }}>{time}</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', flex: 1 }}>{sub}</span>
                  <span style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, background: 'rgba(139,92,246,0.2)', padding: '1px 7px', borderRadius: '5px' }}>{slot}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar card */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            flex: 1, padding: '18px 20px', borderRadius: '16px',
            background: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📅</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Calendar</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[['Today', 'Day Order 3', '#2dd4bf'], ['Mar 28', 'Holiday 🎉', '#facc15'], ['Apr 1', 'Day Order 1', '#2dd4bf']].map(([date, event, col]) => (
                <div key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{date}</span>
                  <span style={{ color: col, fontSize: '12px', fontWeight: 600 }}>{event}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
