import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, List, BarChart3, Landmark, Sun, 
  RefreshCw, Search, WifiOff, Globe, Briefcase, Banknote, TrendingUp,
  PieChart as PieIcon, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzbdUMr75sWraixiabwhlolaIrr7NYkqMH5MXIFRVpWuGhdWpxlghpotxSKGlO4KFJBzA/exec";
const CACHE_KEY = "portfolio_data_v4";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#fbbf24', '#ec4899'];

// --- SUB-COMPONENT: ALLOCATION LIST ---
const AllocationList = ({ title, icon: Icon, data, theme, color }) => {
  if (!data || data.length === 0) return null;
  const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
  
  return (
    <div style={{
      background: theme.card, 
      padding: '16px', 
      borderRadius: '24px', 
      border: '1px solid ' + theme.border, 
      flex: 1, 
      minWidth: '140px'
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
        <Icon size={14} color={color} />
        <p style={{
          fontSize: '11px', 
          fontWeight: 'bold', 
          color: theme.sub, 
          textTransform: 'uppercase', 
          margin: 0
        }}>
          {title}
        </p>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
        {data.map((item, i) => (
          <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px'}}>
            <span style={{fontWeight: '600'}}>{item.name}</span>
            <div style={{textAlign: 'right'}}>
              <span style={{fontWeight: 'bold'}}>{(item.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span style={{fontSize: '9px', color: theme.sub, marginLeft: '6px'}}>
                {total > 0 ? ((item.value / total) * 100).toFixed(1) + '%' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: RANKINGS ---
const Rankings = ({ stocks, theme }) => {
  const top10 = useMemo(() => [...stocks].sort((a, b) => b.profit - a.profit).slice(0, 10), [stocks]);
  const bottom10 = useMemo(() => [...stocks].sort((a, b) => a.profit - b.profit).slice(0, 10), [stocks]);
  
  return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
      <div style={{background: theme.card, padding: '16px', borderRadius: '24px', border: '1px solid ' + theme.border}}>
        <p style={{fontSize: '10px', fontWeight: 'bold', color: '#10b981', marginBottom: '12px', textAlign: 'center'}}>🏆 GAINERS</p>
        {top10.map((s, i) => (
          <div key={i} style={{
            fontSize: '10px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '8px 0', 
            borderBottom: '1px solid ' + theme.border
          }}>
            <span style={{
              fontWeight: '700', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              flex: 1, 
              marginRight: '8px', 
              minWidth: 0
            }}>
              {s.name}
            </span>
            <span style={{color: '#10b981', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right'}}>
              {(s.profit || 0).toFixed(0)} <span style={{fontSize: '8px', opacity: 0.7}}>({((s.percent || 0)*100).toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{background: theme.card, padding: '16px', borderRadius: '24px', border: '1px solid ' + theme.border}}>
        <p style={{fontSize: '10px', fontWeight: 'bold', color: '#ef4444', marginBottom: '12px', textAlign: 'center'}}>📉 LOSERS</p>
        {bottom10.map((s, i) => (
          <div key={i} style={{
            fontSize: '10px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '8px 0', 
            borderBottom: '1px solid ' + theme.border
          }}>
            <span style={{
              fontWeight: '700', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              flex: 1, 
              marginRight: '8px', 
              minWidth: 0
            }}>
              {s.name}
            </span>
            <span style={{color: '#ef4444', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right'}}>
              {(s.profit || 0).toFixed(0)} <span style={{fontSize: '8px', opacity: 0.7}}>({((s.percent || 0)*100).toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: PIES TAB ---
const PiesTab = ({ pies, theme }) => {
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc'); 

  if (!pies || pies.length === 0) return <div style={{textAlign:'center', padding:'40px', color: theme.sub}}>No Pies Found</div>;

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortOrder('desc'); 
    }
  };

  const sortedPies = [...pies].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'value') { valA = a.value; valB = b.value; }
    else if (sortBy === 'profit') { valA = a.profit; valB = b.profit; }
    else { valA = a.returnPct; valB = b.returnPct; } 

    return sortOrder === 'desc' ? valB - valA : valA - valB;
  });

  const SortButton = ({ id, label }) => {
    const isActive = sortBy === id;
    return (
      <button 
        onClick={() => handleSort(id)}
        style={{
          flex: 1,
          padding: '8px 4px',
          fontSize: '10px',
          fontWeight: 'bold',
          borderRadius: '12px',
          border: 'none',
          background: isActive ? theme.text : theme.card,
          color: isActive ? theme.bg : theme.sub,
          border: isActive ? 'none' : '1px solid ' + theme.border,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '4px',
          cursor: 'pointer'
        }}
      >
        {label}
        {isActive && (sortOrder === 'desc' ? <ArrowDown size={10}/> : <ArrowUp size={10}/>)}
      </button>
    );
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
       <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'4px', paddingLeft:'8px'}}>
             <ArrowUpDown size={12} color={theme.sub} />
             <span style={{fontSize:'10px', color:theme.sub, fontWeight:'bold'}}>SORT:</span>
          </div>
          <SortButton id="value" label="Value" />
          <SortButton id="profit" label="Return $" />
          <SortButton id="percent" label="Return %" />
       </div>

       {sortedPies.map((pie, i) => (
         <div key={i} style={{background: theme.card, borderRadius: '24px', border: '1px solid ' + theme.border, padding: '20px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
               <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                  <div style={{background: COLORS[i % COLORS.length] + '22', padding:'10px', borderRadius:'14px', color: COLORS[i % COLORS.length]}}>
                    <PieIcon size={24} />
                  </div>
                  <div>
                    <h3 style={{margin:0, fontSize:'16px', fontWeight:'bold'}}>{pie.name}</h3>
                    <p style={{margin:0, fontSize:'11px', color: theme.sub, marginTop:'2px'}}>Investment Pie</p>
                  </div>
               </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingTop: '16px', borderTop: '1px solid ' + theme.border}}>
               <div>
                  <div style={{marginBottom: '12px'}}>
                    <p style={{margin:0, fontSize:'10px', color: theme.sub, fontWeight:'bold', textTransform:'uppercase'}}>Invested</p>
                    <p style={{margin:0, fontSize:'15px', fontWeight:'700'}}>{pie.invested.toLocaleString()} <span style={{fontSize:'10px', opacity:0.6}}>CZK</span></p>
                  </div>
                  <div>
                    <p style={{margin:0, fontSize:'10px', color: theme.sub, fontWeight:'bold', textTransform:'uppercase'}}>Value</p>
                    <p style={{margin:0, fontSize:'15px', fontWeight:'700'}}>{pie.value.toLocaleString()} <span style={{fontSize:'10px', opacity:0.6}}>CZK</span></p>
                  </div>
               </div>
               <div style={{textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                  <p style={{margin:0, fontSize:'10px', color: theme.sub, fontWeight:'bold', textTransform:'uppercase'}}>Total Return</p>
                  <p style={{margin:0, fontSize:'22px', fontWeight:'900', color: pie.profit >= 0 ? '#10b981' : '#ef4444'}}>
                    {pie.profit > 0 ? '+' : ''}{pie.profit.toLocaleString()}
                  </p>
                  <p style={{margin:0, fontSize:'13px', fontWeight:'bold', color: pie.returnPct >= 0 ? '#10b981' : '#ef4444'}}>
                    {pie.returnPct > 0 ? '+' : ''}{(pie.returnPct * 100).toFixed(2)}%
                  </p>
               </div>
            </div>
         </div>
       ))}
    </div>
  );
};

// --- SUB-COMPONENT: DIVIDENDS ---
const DividendsTab = ({ chartData, theme }) => {
  const snowballData = useMemo(() => {
    return (chartData?.dividends || []).map(item => {
      const d = new Date(item.date);
      return {
        ...item,
        displayDate: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : item.date,
        fullDate: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : item.date
      };
    });
  }, [chartData]);

  const monthlyIncomeData = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (!raw.length) return [];
    
    const increments = raw.map((item, i) => {
       const prevTotal = i > 0 ? raw[i-1].total : 0;
       const amount = item.total - prevTotal;
       return { date: item.date, amount: amount > 0 ? amount : 0 };
    });

    const grouped = {};
    increments.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { amount: 0, dateObj: d };
      grouped[key].amount += item.amount;
    });

    return Object.keys(grouped).sort().map(key => {
      const { amount, dateObj } = grouped[key];
      return {
        amount,
        displayDate: dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        fullDate: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
    });
  }, [chartData]);

  const yearlyStats = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (raw.length === 0) return {};
    const getMaxInYear = (year) => {
      const entries = raw.filter(d => new Date(d.date).getFullYear() === year);
      return entries.length === 0 ? 0 : entries[entries.length - 1].total;
    };
    const total2024 = getMaxInYear(2024);
    const total2025 = getMaxInYear(2025) - (raw.some(d => new Date(d.date).getFullYear() === 2024) ? getMaxInYear(2024) : 0);
    const total2026 = getMaxInYear(2026) - getMaxInYear(2025);
    return {
      2024: { total: total2024, avg: total2024 / 12 },
      2025: { total: total2025, avg: total2025 / 12 },
      2026: { total: total2026, avg: total2026 / 1 }
    };
  }, [chartData]);

  const StatCard = ({ year, data, color }) => (
    <div style={{background: theme.card, padding: '16px', borderRadius: '20px', border: '1px solid ' + theme.border, flex: 1}}>
      <p style={{fontSize: '10px', color: theme.sub, fontWeight: 'bold', marginBottom: '4px'}}>{year} TOTAL</p>
      <p style={{fontSize: '18px', fontWeight: '900', color: color, margin: 0}}>{(data?.total || 0).toFixed(0)}</p>
      <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid '+theme.border}}>
         <p style={{fontSize: '9px', color: theme.sub}}>MONTHLY AVG</p>
         <p style={{fontSize: '12px', fontWeight: 'bold'}}>{(data?.avg || 0).toFixed(1)}</p>
      </div>
    </div>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
        padding: '30px', 
        borderRadius: '32px', 
        color: '#fff', 
        boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px'}}>
          <TrendingUp size={20} color="#fff" style={{opacity: 0.8}}/>
          <p style={{fontSize: '11px', opacity: 0.9, fontWeight: 'bold', letterSpacing: '1px'}}>DIVIDEND</p>
        </div>
        <h2 style={{fontSize: '42px', fontWeight: '900', margin: '0'}}>
          {(chartData?.dividends?.length > 0 ? chartData.dividends[chartData.dividends.length-1].total : 0).toLocaleString()} 
          <span style={{fontSize: '16px', opacity: 0.8}}> CZK</span>
        </h2>
        <p style={{fontSize: '12px', opacity: 0.8, marginTop: '4px'}}>Cumulative Passive Income</p>
      </div>
      
      <div style={{display: 'flex', gap: '12px'}}>
        <StatCard year="2024" data={yearlyStats[2024]} color={theme.sub} />
        <StatCard year="2025" data={yearlyStats[2025]} color="#3b82f6" />
        <StatCard year="2026" data={yearlyStats[2026]} color="#10b981" />
      </div>

      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>MONTHLY INCOME HISTORY</h3>
        <div style={{height: '220px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyIncomeData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="displayDate" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={true} minTickGap={10} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}/>
              <Tooltip 
                cursor={{fill: theme.text, opacity: 0.05}} 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                labelStyle={{color: theme.text, fontWeight: 'bold'}} 
                itemStyle={{color: '#10b981'}} 
                formatter={(value) => [value.toLocaleString() + ' CZK', 'Income']}
              />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>CUMULATIVE GROWTH</h3>
        <div style={{height: '220px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snowballData} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="colorDivs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="displayDate" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}/>
              <Tooltip 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                labelStyle={{color: theme.text, fontWeight: 'bold'}} 
                itemStyle={{color: '#10b981'}} 
                formatter={(value) => [value.toLocaleString() + ' CZK', 'Total Income']}
              />
              <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDivs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: ANALYTICS (TIME MACHINE ADDED) ---
const AnalyticsTab = ({ stocks, chartData, theme }) => {
  const investData = useMemo(() => {
    return (chartData?.invested || []).map(item => {
      const d = new Date(item.month);
      return { 
        ...item, 
        axisLabel: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : item.month 
      };
    });
  }, [chartData]);

  const historyData = useMemo(() => {
    return (chartData?.history || []).map(item => {
      const d = new Date(item.date);
      return {
        ...item,
        dateLabel: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : item.date,
        investedVal: Number(item.invested),
        balanceVal: Number(item.balance)
      };
    });
  }, [chartData]);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      
      {/* TIME MACHINE CHART (THE HARDEST THING) */}
      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <div style={{display:'flex', alignItems:'center', gap:'8px', justifyContent:'center', marginBottom:'20px'}}>
           <TrendingUp size={16} color="#10b981" />
           <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, margin:0, textTransform:'uppercase'}}>Time Machine: Growth vs Investment</h3>
        </div>
        <div style={{height: '250px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="dateLabel" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
              <Tooltip 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}}
                itemStyle={{fontSize: '12px'}}
              />
              <Area type="stepAfter" dataKey="investedVal" stroke={theme.sub} fill="transparent" strokeDasharray="5 5" name="Invested" />
              <Area type="monotone" dataKey="balanceVal" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBal)" name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p style={{fontSize:'9px', color:theme.sub, textAlign:'center', marginTop:'10px'}}>Dotted line is money put in. Solid area is current value.</p>
      </div>

      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>STOCK ALLOCATION</h3>
        <div style={{height: '300px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stocks} innerRadius={0} outerRadius={100} dataKey="value" paddingAngle={1}>
                {stocks.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} stroke={theme.card} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                itemStyle={{color: theme.text}} 
                formatter={(value) => value.toLocaleString() + ' CZK'} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>MONTHLY CASH INVESTED</h3>
        <div style={{height: '220px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={investData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="axisLabel" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={true} minTickGap={10} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}/>
              <Tooltip 
                cursor={{fill: theme.text, opacity: 0.1}} 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                labelStyle={{color: theme.text, fontWeight: 'bold'}} 
                itemStyle={{color: '#8b5cf6'}} 
                formatter={(value) => [value.toLocaleString() + ' CZK', 'Invested']}
              />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: SUMMARY CARD ---
const SummaryCard = ({ summary, theme }) => {
  const totalValue = summary.totalValue || 0;
  const profit = summary.totalPL || 0;
  const invested = totalValue - profit; 
  const returnPct = invested > 0 ? (profit / invested) * 100 : 0;
  const isProfit = profit >= 0;

  return (
    <div style={{
      background: theme.card, 
      padding: '24px', 
      borderRadius: '28px', 
      border: '1px solid ' + theme.border, 
      textAlign: 'center'
    }}>
      <p style={{fontSize: '11px', color: theme.sub, fontWeight: 'bold', textTransform: 'uppercase'}}>Current Balance</p>
      <h2 style={{fontSize: '42px', fontWeight: '900', margin: '8px 0', letterSpacing: '-1px'}}>
        {totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})} 
        <span style={{fontSize: '16px', opacity: 0.5, marginLeft: '6px'}}>CZK</span>
      </h2>
      <div style={{
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: '8px', 
        margin: '20px 0', 
        padding: '16px 0', 
        borderTop: '1px solid '+theme.border, 
        borderBottom: '1px solid '+theme.border
      }}>
         <div>
           <p style={{fontSize: '9px', color: theme.sub, fontWeight: 'bold'}}>INVESTED</p>
           <p style={{margin: 0, fontWeight: '800', fontSize: '13px'}}>{invested.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
         </div>
         <div>
           <p style={{fontSize: '9px', color: theme.sub, fontWeight: 'bold'}}>PROFIT (CZK)</p>
           <p style={{margin: 0, fontWeight: '800', fontSize: '13px', color: isProfit ? '#10b981' : '#ef4444'}}>
             {isProfit ? '+' : ''}{profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
           </p>
         </div>
         <div>
           <p style={{fontSize: '9px', color: theme.sub, fontWeight: 'bold'}}>RETURN (%)</p>
           <p style={{margin: 0, fontWeight: '800', fontSize: '13px', color: isProfit ? '#10b981' : '#ef4444'}}>
             {isProfit ? '+' : ''}{returnPct.toFixed(2)}%
           </p>
         </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
        <div style={{background: theme.bg, padding: '12px', borderRadius: '18px', border: '1px solid ' + theme.border}}>
          <p style={{fontSize: '9px', color: '#3b82f6', fontWeight: 'bold'}}>DIVIDENDS (TOTAL)</p>
          <p style={{margin: 0, fontWeight: '900'}}>{(summary.totalDividends || 0).toLocaleString()}</p>
        </div>
        <div style={{background: theme.bg, padding: '12px', borderRadius: '18px', border: '1px solid ' + theme.border}}>
          <p style={{fontSize: '9px', color: '#10b981', fontWeight: 'bold'}}>FREE CASH</p>
          <p style={{margin: 0, fontWeight: '900'}}>{(summary.freeCash || 0).toLocaleString()}</p>
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
        <div style={{background: theme.bg, padding: '12px', borderRadius: '18px', border: '1px solid ' + theme.border}}>
          <p style={{fontSize: '9px', color: theme.sub, fontWeight: 'bold'}}>AVG / MO (2025)</p>
          <p style={{margin: 0, fontWeight: '900'}}>{(summary.divsMonthly2025 || 0).toLocaleString()}</p>
        </div>
        <div style={{background: theme.bg, padding: '12px', borderRadius: '18px', border: '1px solid ' + theme.border}}>
          <p style={{fontSize: '9px', color: theme.sub, fontWeight: 'bold'}}>AVG / MO (2026)</p>
          <p style={{margin: 0, fontWeight: '900'}}>{(summary.divsMonthly2026 || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: STOCK CARD ---
const StockCard = ({ stock, theme }) => {
  const isProfit = stock.profit >= 0;
  const totalReturn = stock.profit + (stock.dividendPaid || 0);
  const totalReturnPct = stock.invested > 0 ? (totalReturn / stock.invested) * 100 : 0;
  const isTotalProfit = totalReturn >= 0;

  return (
    <div style={{background: theme.card, borderRadius: '20px', border: '1px solid ' + theme.border, padding: '16px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', flex: 1, minWidth:0}}>
          <h3 style={{margin:0, fontSize:'15px', fontWeight:'800', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            {stock.name}
          </h3>
        </div>
        <div style={{background: theme.bg, padding: '6px 10px', borderRadius: '12px'}}>
          <p style={{margin:0, fontSize:'11px', fontWeight:'bold', color: theme.sub}}>
            Qty: <span style={{color: theme.text}}>{stock.quantity || '-'}</span>
          </p>
        </div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: theme.sub, marginBottom: '12px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
          <span>Avg:</span>
          <span style={{fontWeight:'bold', color: theme.text}}>{(stock.avgPrice || 0).toFixed(2)}</span>
        </div>
        <ArrowRight size={12} style={{opacity: 0.5}}/>
        <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
          <span>Curr:</span>
          <span style={{fontWeight:'bold', color: theme.text}}>{(stock.currPrice || 0).toFixed(2)}</span>
        </div>
      </div>
      <div style={{background: theme.bg, borderRadius: '16px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 8px'}}>
         <div>
           <p style={{margin:0, fontSize:'9px', color: theme.sub, fontWeight:'bold'}}>INVESTED</p>
           <p style={{margin:0, fontSize:'13px', fontWeight:'800'}}>{stock.invested.toLocaleString()}</p>
         </div>
         <div style={{textAlign: 'right'}}>
           <p style={{margin:0, fontSize:'9px', color: theme.sub, fontWeight:'bold'}}>VALUE</p>
           <p style={{margin:0, fontSize:'13px', fontWeight:'800'}}>{stock.value.toLocaleString()}</p>
         </div>
         <div>
           <p style={{margin:0, fontSize:'9px', color: theme.sub, fontWeight:'bold'}}>CAPITAL GAIN</p>
           <div style={{display:'flex', gap:'4px', alignItems:'baseline'}}>
             <p style={{margin:0, fontSize:'13px', fontWeight:'800', color: isProfit ? '#10b981' : '#ef4444'}}>
               {isProfit ? '+' : ''}{stock.profit.toFixed(0)}
             </p>
             <span style={{fontSize:'10px', color: isProfit ? '#10b981' : '#ef4444'}}>
               ({(stock.percent * 100).toFixed(1)}%)
             </span>
           </div>
         </div>
         <div style={{textAlign: 'right'}}>
           <p style={{margin:0, fontSize:'9px', color: theme.sub, fontWeight:'bold'}}>TOTAL RETURN</p>
           <div style={{display:'flex', gap:'4px', alignItems:'baseline', justifyContent: 'flex-end'}}>
             <p style={{margin:0, fontSize:'13px', fontWeight:'800', color: isTotalProfit ? '#10b981' : '#ef4444'}}>
               {isTotalProfit ? '+' : ''}{totalReturn.toFixed(0)}
             </p>
             <span style={{fontSize:'10px', color: isTotalProfit ? '#10b981' : '#ef4444'}}>
               ({totalReturnPct.toFixed(1)}%)
             </span>
           </div>
           {stock.dividendPaid > 0 && (
             <p style={{margin:0, fontSize:'9px', color: '#3b82f6', marginTop:'2px'}}>
               (Include {stock.dividendPaid.toFixed(0)} in dividends)
             </p>
           )}
         </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION ---
export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [usingCache, setUsingCache] = useState(false); 

  const [listSortBy, setListSortBy] = useState('value');
  const [listSortOrder, setListSortOrder] = useState('desc');

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { 
      try { 
        setData(JSON.parse(cached)); 
        setUsingCache(true); 
      } catch (e) {} 
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const cb = Date.now();
    try {
      const urls = [
        `https://corsproxy.io/?${encodeURIComponent(SCRIPT_URL)}&t=${cb}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(SCRIPT_URL)}&t=${cb}`,
        `${SCRIPT_URL}?t=${cb}`
      ];

      let json = null;
      for (let url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const raw = await res.json();
          json = raw.contents ? JSON.parse(raw.contents) : raw;
          if (json) break;
        } catch(e) { continue; }
      }

      if (json) {
        setData(json);
        localStorage.setItem(CACHE_KEY, JSON.stringify(json));
        setErrorMsg(null);
        setUsingCache(false);
      } else {
        throw new Error("Data empty");
      }
    } catch (err) { 
      console.log("Fetch failed", err);
      if (!localStorage.getItem(CACHE_KEY)) {
        setErrorMsg("Could not connect to portfolio. Check script URL or connection.");
      } else {
        setUsingCache(true);
      }
    }
    setLoading(false);
  };

  const theme = {
    bg: isDark ? '#000' : '#f8fafc',
    card: isDark ? '#0a0a0a' : '#ffffff',
    text: isDark ? '#fff' : '#0f172a',
    border: isDark ? '#1a1a1a' : '#e2e8f0',
    sub: isDark ? '#71717a' : '#64748b'
  };

  const handleListSort = (key) => {
    if (listSortBy === key) {
      setListSortOrder(listSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setListSortBy(key);
      setListSortOrder('desc');
    }
  };

  const stocksOnly = useMemo(() => {
    if (!data) return [];
    let list = (data.allPositions || []).filter(s => s.value >= 50 && !String(s.name).toLowerCase().includes('pie'));
    
    list.sort((a, b) => {
      let valA, valB;
      const totRetA = a.profit + (a.dividendPaid || 0);
      const totRetB = b.profit + (b.dividendPaid || 0);
      
      switch(listSortBy) {
        case 'value': valA = a.value; valB = b.value; break;
        case 'gain': valA = a.profit; valB = b.profit; break;
        case 'gainPct': valA = a.percent; valB = b.percent; break;
        case 'totRet': valA = totRetA; valB = totRetB; break;
        case 'totRetPct': valA = a.invested > 0 ? (totRetA/a.invested) : 0; valB = b.invested > 0 ? (totRetB/b.invested) : 0; break;
        case 'divs': valA = a.dividendPaid || 0; valB = b.dividendPaid || 0; break;
        default: valA = a.value; valB = b.value;
      }
      return listSortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return list;
  }, [data, listSortBy, listSortOrder]);

  const ListSortButton = ({ id, label }) => {
    const isActive = listSortBy === id;
    return (
      <button 
        onClick={() => handleListSort(id)}
        style={{
          padding: '6px 12px',
          fontSize: '9px',
          fontWeight: 'bold',
          borderRadius: '10px',
          border: 'none',
          background: isActive ? theme.text : theme.card,
          color: isActive ? theme.bg : theme.sub,
          border: isActive ? 'none' : '1px solid ' + theme.border,
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          whiteSpace: 'nowrap',
          cursor: 'pointer'
        }}
      >
        {label}
        {isActive && (listSortOrder === 'desc' ? <ArrowDown size={10}/> : <ArrowUp size={10}/>)}
      </button>
    );
  };

  return (
    <div style={{background: theme.bg, minHeight: '100vh', color: theme.text, display: 'flex', justifyContent: 'center'}}>
      <div style={{width: '100%', maxWidth: '1200px', position: 'relative'}}>
        
        <header style={{
            position: 'sticky', 
            top: 0, 
            zIndex: 1000,
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px', 
            borderBottom: '1px solid ' + theme.border,
            background: theme.bg + 'cc', 
            backdropFilter: 'blur(16px)', 
            WebkitBackdropFilter: 'blur(16px)'
        }}>
          <div>
            <h1 style={{fontSize: '20px', fontWeight: '900', margin: 0}}>
              Jamiez <span style={{color: '#10b981'}}>Portfolio</span>
            </h1>
            {usingCache && !loading && <span style={{fontSize:'10px', color: theme.sub}}>Offline Mode</span>}
          </div>
          <div style={{display: 'flex', gap: '8px'}}>
            <button 
              onClick={() => setIsDark(!isDark)} 
              style={{background: theme.card, border: '1px solid ' + theme.border, padding: '10px', borderRadius: '12px', color: theme.text}}
            >
              <Sun size={18}/>
            </button>
            <button 
              onClick={fetchData} 
              style={{background: theme.card, border: '1px solid ' + theme.border, padding: '10px', borderRadius: '12px', color: theme.text}}
            >
              {loading ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
            </button>
          </div>
        </header>

        {errorMsg && (
          <div style={{margin: '16px', padding: '16px', background: '#ef444433', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444'}}>
            {errorMsg}
          </div>
        )}

        {data && (
          <main style={{padding: '16px', paddingBottom: '120px'}}>
            {activeTab === 'summary' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <SummaryCard summary={data.accountSummary} theme={theme} />
                <Rankings stocks={stocksOnly} theme={theme} />
              </div>
            )}
            
            {activeTab === 'list' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <div style={{
                  display:'flex', 
                  alignItems:'center', 
                  background: theme.card, 
                  border: '1px solid '+theme.border, 
                  padding:'12px 16px', 
                  borderRadius:'18px'
                }}>
                  <Search size={18} style={{marginRight:'12px', color:theme.sub}}/>
                  <input 
                    placeholder="Search assets..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    style={{background:'none', border:'none', color:theme.text, width:'100%', outline:'none'}} 
                  />
                </div>

                <div style={{
                  display: 'flex', 
                  gap: '8px', 
                  overflowX: 'auto', 
                  paddingBottom: '4px',
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none'
                }}>
                  <ListSortButton id="value" label="Value" />
                  <ListSortButton id="gain" label="Cap. Gain" />
                  <ListSortButton id="gainPct" label="Gain %" />
                  <ListSortButton id="totRet" label="Tot. Return" />
                  <ListSortButton id="totRetPct" label="Return %" />
                  <ListSortButton id="divs" label="Dividends" />
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {stocksOnly.filter(s => String(s.name).toLowerCase().includes(searchTerm.toLowerCase())).map((s, i) => (
                    <StockCard key={i} stock={s} theme={theme} />
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'pies' && <PiesTab pies={data.pies} theme={theme} />}
            {activeTab === 'analytics' && <AnalyticsTab stocks={stocksOnly} chartData={data.charts} theme={theme} />}
            {activeTab === 'dividends' && <DividendsTab chartData={data.charts} theme={theme} />}
          </main>
        )}

        <nav style={{
          position: 'fixed', 
          bottom: '25px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: '92%', 
          maxWidth: '650px', 
          background: theme.card + 'cc', 
          backdropFilter: 'blur(20px)', 
          WebkitBackdropFilter: 'blur(20px)', 
          padding: '10px', 
          borderRadius: '40px', 
          display: 'flex', 
          border: '1px solid ' + theme.border, 
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', 
          zIndex: 1000
        }}>
          {[ 
            { id: 'summary', icon: LayoutDashboard }, 
            { id: 'list', icon: List }, 
            { id: 'pies', icon: PieIcon }, 
            { id: 'analytics', icon: BarChart3 }, 
            { id: 'dividends', icon: Landmark } 
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              style={{
                flex: 1, 
                background: activeTab === tab.id ? theme.text : 'transparent', 
                color: activeTab === tab.id ? theme.bg : theme.sub, 
                border: 'none', 
                borderRadius: '30px', 
                padding: '12px', 
                display: 'flex', 
                justifyContent: 'center', 
                transition: '0.3s'
              }}
            >
              <tab.icon size={22} />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}