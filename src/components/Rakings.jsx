// src/components/Rankings.jsx
import React, { useState, useMemo } from 'react';

const Rankings = ({ stocks, theme }) => {
  const [showGainers, setShowGainers] = useState(true);
  const [showLosers, setShowLosers] = useState(false);

  const top10 = useMemo(() => [...stocks].sort((a, b) => b.profit - a.profit).slice(0, 10), [stocks]);
  const bottom10 = useMemo(() => [...stocks].sort((a, b) => a.profit - b.profit).slice(0, 10), [stocks]);
  
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px'}}>
      
      {/* GAINERS BLOCK */}
      <div style={{background: theme.card, padding: '16px', borderRadius: '24px', border: '1px solid ' + theme.border}}>
        <div 
          onClick={() => setShowGainers(!showGainers)} 
          style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showGainers ? '12px' : '0'}}
        >
          <p style={{fontSize: '14px', fontWeight: 'bold', color: '#10b981', margin: 0}}>🏆 TOP GAINERS</p>
          <span style={{fontSize: '18px', color: theme.sub, fontWeight: 'bold'}}>{showGainers ? '−' : '+'}</span>
        </div>
        
        {showGainers && top10.map((s, i) => (
          <div key={i} style={{
            fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '10px 0', borderBottom: '1px solid ' + theme.border
          }}>
            <span style={{fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px', minWidth: 0}}>
              {s.name}
            </span>
            <span style={{color: '#10b981', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right'}}>
              +{(s.profit || 0).toLocaleString()} <span style={{fontSize: '10px', opacity: 0.7}}>({((s.percent || 0)*100).toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>

      {/* LOSERS BLOCK */}
      <div style={{background: theme.card, padding: '16px', borderRadius: '24px', border: '1px solid ' + theme.border}}>
        <div 
          onClick={() => setShowLosers(!showLosers)} 
          style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: showLosers ? '12px' : '0'}}
        >
          <p style={{fontSize: '14px', fontWeight: 'bold', color: '#ef4444', margin: 0}}>📉 TOP LOSERS</p>
          <span style={{fontSize: '18px', color: theme.sub, fontWeight: 'bold'}}>{showLosers ? '−' : '+'}</span>
        </div>

        {showLosers && bottom10.map((s, i) => (
          <div key={i} style={{
            fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '10px 0', borderBottom: '1px solid ' + theme.border
          }}>
            <span style={{fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px', minWidth: 0}}>
              {s.name}
            </span>
            <span style={{color: '#ef4444', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right'}}>
              {(s.profit || 0).toLocaleString()} <span style={{fontSize: '10px', opacity: 0.7}}>({((s.percent || 0)*100).toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rankings;