import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Download, Filter, Map, RefreshCw, Settings, Info, Calendar } from 'lucide-react';

const MOCK_API_RESPONSE = {
    "location": {
        "facility": "Warehouse A",
        "floor": "Ground Floor",
        "dimensions": { "width": 4000, "height": 4000 }
    },
    "environment": {
        "zones": [
            { "id": "z1", "type": "warning", "polygon": [[500, 500], [1500, 500], [1500, 1500], [500, 1500]] },
            { "id": "z2", "type": "restricted", "polygon": [[2500, 2000], [3500, 2000], [3500, 3000], [2500, 3000]] }
        ],
        "walls": [
            [[100, 100], [100, 3900]],
            [[100, 3900], [3900, 3900]],
            [[3900, 3900], [3900, 100]],
            [[3900, 100], [100, 100]],
            [[2000, 100], [2000, 1500]],
            [[2000, 2500], [2000, 3900]]
        ]
    },
    "assets": [
        {
            "mac_address": "AA:BB:CC:DD:EE:01",
            "type": "forklift",
            "name": "Forklift 1",
            "battery": 85,
            "status": "active",
            "current_location": { "x": 1200, "y": 800 },
            "path": [
                { "x": 800, "y": 800, "timestamp": "2026-09-03T10:00:00Z" },
                { "x": 1000, "y": 800, "timestamp": "2026-09-03T10:05:00Z" },
                { "x": 1200, "y": 800, "timestamp": "2026-09-03T10:10:00Z" }
            ]
        },
        {
            "mac_address": "AA:BB:CC:DD:EE:02",
            "type": "pallet_jack",
            "name": "Pallet Jack A",
            "battery": 42,
            "status": "idle",
            "current_location": { "x": 2800, "y": 2500 },
            "path": [
                { "x": 3000, "y": 2500, "timestamp": "2026-09-03T09:30:00Z" },
                { "x": 2900, "y": 2500, "timestamp": "2026-09-03T09:35:00Z" },
                { "x": 2800, "y": 2500, "timestamp": "2026-09-03T09:40:00Z" }
            ]
        },
        {
            "mac_address": "AA:BB:CC:DD:EE:03",
            "type": "worker",
            "name": "Worker John",
            "battery": 99,
            "status": "active",
            "current_location": { "x": 1800, "y": 3200 },
            "path": [
                { "x": 1500, "y": 3500, "timestamp": "2026-09-03T11:00:00Z" },
                { "x": 1600, "y": 3300, "timestamp": "2026-09-03T11:15:00Z" },
                { "x": 1800, "y": 3200, "timestamp": "2026-09-03T11:30:00Z" }
            ]
        }
    ]
};

const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return day + '/' + month + ' ' + hours + ':' + minutes;
};

export default function AssetDashboard() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    
    const [data, setData] = useState(null);
    const [environment, setEnvironment] = useState({ zones: [], walls: [] });
    const [assets, setAssets] = useState([]);
    
    const [mode, setMode] = useState('path');
    const [selectedAssets, setSelectedAssets] = useState(new Set());
    const [hoveredNode, setHoveredNode] = useState(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(100);
    
    const [fetchIntervalMins, setFetchIntervalMins] = useState(5);
    const [lastFetched, setLastFetched] = useState(null);
    const [isMocking, setIsMocking] = useState(false);
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchData = useCallback(() => {
        setTimeout(() => {
            const response = MOCK_API_RESPONSE;
            setData(response.location);
            setEnvironment(response.environment);
            setAssets(response.assets);
            setLastFetched(new Date());
            
            if (selectedAssets.size === 0) {
                setSelectedAssets(new Set(response.assets.map(a => a.mac_address)));
            }

            if (!startDate && !endDate && response.assets.length > 0) {
                 let minTime = Infinity;
                 let maxTime = -Infinity;
                 response.assets.forEach(asset => {
                     asset.path.forEach(node => {
                         const time = new Date(node.timestamp).getTime();
                         if (time < minTime) minTime = time;
                         if (time > maxTime) maxTime = time;
                     });
                 });
                 if (minTime !== Infinity) {
                     const minDate = new Date(minTime);
                     const maxDate = new Date(maxTime);
                     const minStr = new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                     const maxStr = new Date(maxDate.getTime() - maxDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                     setStartDate(minStr);
                     setEndDate(maxStr);
                 }
            }
        }, 500);
    }, [selectedAssets.size, startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        let intervalId;
        if (isMocking && fetchIntervalMins > 0) {
            intervalId = setInterval(fetchData, fetchIntervalMins * 60 * 1000);
        }
        return () => clearInterval(intervalId);
    }, [isMocking, fetchIntervalMins, fetchData]);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !data) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = container.getBoundingClientRect();
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.clearRect(0, 0, width, height);

        const logicalWidth = data.dimensions.width;
        const logicalHeight = data.dimensions.height;
        const scaleX = width / logicalWidth;
        const scaleY = height / logicalHeight;

        environment.zones.forEach(zone => {
            ctx.beginPath();
            zone.polygon.forEach((point, i) => {
                const px = point[0] * scaleX;
                const py = point[1] * scaleY;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.fillStyle = zone.type === 'warning' ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
            ctx.fill();
            ctx.strokeStyle = zone.type === 'warning' ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
            ctx.stroke();
        });

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        environment.walls.forEach(wall => {
            ctx.beginPath();
            ctx.moveTo(wall[0][0] * scaleX, wall[0][1] * scaleY);
            ctx.lineTo(wall[1][0] * scaleX, wall[1][1] * scaleY);
            ctx.stroke();
        });

        const startFilterTime = startDate ? new Date(startDate).getTime() : -Infinity;
        const endFilterTime = endDate ? new Date(endDate).getTime() : Infinity;

        const visibleAssets = assets.filter(a => selectedAssets.has(a.mac_address));

        visibleAssets.forEach(asset => {
            const color = asset.type === 'forklift' ? '#3b82f6' : asset.type === 'worker' ? '#10b981' : '#8b5cf6';
            
            const filteredPath = asset.path.filter(node => {
                const nodeTime = new Date(node.timestamp).getTime();
                return nodeTime >= startFilterTime && nodeTime <= endFilterTime;
            });

            if (filteredPath.length === 0) return;

            const pathLimit = Math.max(1, Math.floor((progress / 100) * filteredPath.length));
            const currentPath = filteredPath.slice(0, pathLimit);

            if (mode === 'path') {
                if (currentPath.length > 1) {
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    currentPath.forEach((p, i) => {
                        const px = p.x * scaleX;
                        const py = p.y * scaleY;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                
                currentPath.forEach(p => {
                    const px = p.x * scaleX;
                    const py = p.y * scaleY;
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                });

                if (currentPath.length > 0) {
                    const head = currentPath[currentPath.length - 1];
                    const px = head.x * scaleX;
                    const py = head.y * scaleY;
                    ctx.beginPath();
                    ctx.arc(px, py, 8, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, 2 * Math.PI);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }

            } else if (mode === 'heatmap') {
                currentPath.forEach(p => {
                    const px = p.x * scaleX;
                    const py = p.y * scaleY;
                    const gradient = ctx.createRadialGradient(px, py, 0, px, py, 30);
                    gradient.addColorStop(0, color + '66');
                    gradient.addColorStop(1, 'transparent');
                    ctx.beginPath();
                    ctx.arc(px, py, 30, 0, 2 * Math.PI);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                });
            }
        });

    }, [data, environment, assets, mode, selectedAssets, progress, startDate, endDate]);

    useEffect(() => {
        drawCanvas();
        window.addEventListener('resize', drawCanvas);
        return () => window.removeEventListener('resize', drawCanvas);
    }, [drawCanvas]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !data) return;

        const handleMouseMove = (e) => {
            if (mode !== 'path') {
                setHoveredNode(null);
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const logicalWidth = data.dimensions.width;
            const logicalHeight = data.dimensions.height;
            const scaleX = rect.width / logicalWidth;
            const scaleY = rect.height / logicalHeight;

            let foundNode = null;
            const startFilterTime = startDate ? new Date(startDate).getTime() : -Infinity;
            const endFilterTime = endDate ? new Date(endDate).getTime() : Infinity;
            const visibleAssets = assets.filter(a => selectedAssets.has(a.mac_address));

            for (const asset of visibleAssets) {
                const filteredPath = asset.path.filter(node => {
                    const nodeTime = new Date(node.timestamp).getTime();
                    return nodeTime >= startFilterTime && nodeTime <= endFilterTime;
                });
                const pathLimit = Math.max(1, Math.floor((progress / 100) * filteredPath.length));
                const currentPath = filteredPath.slice(0, pathLimit);

                for (const node of currentPath) {
                    const nodeX = node.x * scaleX;
                    const nodeY = node.y * scaleY;
                    const dist = Math.sqrt(Math.pow(mouseX - nodeX, 2) + Math.pow(mouseY - nodeY, 2));
                    if (dist < 10) {
                        foundNode = {
                            x: e.clientX,
                            y: e.clientY,
                            timestamp: node.timestamp,
                            assetName: asset.name
                        };
                        break;
                    }
                }
                if (foundNode) break;
            }
            setHoveredNode(foundNode);
        };

        const handleMouseLeave = () => setHoveredNode(null);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [data, assets, selectedAssets, progress, startDate, endDate, mode]);

    useEffect(() => {
        let animationFrameId;
        const renderLoop = () => {
            if (isPlaying) {
                setProgress(prev => {
                    if (prev >= 100) return 0;
                    return prev + 0.5;
                });
                animationFrameId = requestAnimationFrame(renderLoop);
            }
        };
        if (isPlaying) animationFrameId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying]);

    const toggleAsset = (mac_address) => {
        const newSet = new Set(selectedAssets);
        if (newSet.has(mac_address)) newSet.delete(mac_address);
        else newSet.add(mac_address);
        setSelectedAssets(newSet);
    };

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = 'asset-map-' + new Date().toISOString() + '.png';
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    if (!data) return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500">Loading Dashboard...</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans">
            <header className="flex justify-between items-center p-4 bg-white border-b border-slate-200 shadow-sm z-10">
                <div className="flex items-center space-x-3">
                    <Map className="text-blue-600" size={24} />
                    <div>
                        <h1 className="text-xl font-semibold leading-tight text-slate-900">Live Asset Tracking</h1>
                        <p className="text-sm text-slate-500">{data.facility} &bull; {data.floor}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="text-xs text-slate-500 flex items-center">
                        <RefreshCw size={12} className="mr-1" />
                        Last sync: {lastFetched ? lastFetched.toLocaleTimeString() : 'Never'}
                    </div>
                    <button onClick={handleDownload} className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors border border-blue-200">
                        <Download size={16} className="mr-2" />
                        Export PNG
                    </button>
                </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 overflow-y-auto">
                    <div className="p-5 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center">
                            <Settings size={14} className="mr-1.5"/> Visualization
                        </h3>
                        <div className="flex rounded-md p-1 bg-slate-100">
                            <button onClick={() => setMode('path')} className={'flex-1 py-1.5 text-sm font-medium rounded-sm transition-all ' + (mode === 'path' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>Path Nodes</button>
                            <button onClick={() => setMode('heatmap')} className={'flex-1 py-1.5 text-sm font-medium rounded-sm transition-all ' + (mode === 'heatmap' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>Heat Map</button>
                        </div>
                    </div>
                     <div className="p-5 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center">
                            <Calendar size={14} className="mr-1.5"/> Date / Time Range
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-md bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">End Time</label>
                                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-md bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                            </div>
                            <button onClick={() => { setStartDate(''); setEndDate(''); setProgress(100); }} className="w-full py-1.5 text-xs text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors">Clear Filters</button>
                        </div>
                    </div>
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Time Simulation</h3>
                        <div className="flex items-center space-x-3 mb-2">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                            </button>
                            <input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                        </div>
                        <div className="text-right text-xs text-slate-500 font-mono">{Math.round(progress)}% Segment</div>
                    </div>
                    <div className="p-5 flex-1 overflow-y-auto">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                                <Filter size={14} className="mr-1.5"/> Tracked Entities
                            </h3>
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">{selectedAssets.size} / {assets.length}</span>
                        </div>
                        <div className="space-y-2">
                            {assets.map(asset => (
                                <label key={asset.mac_address} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer group transition-colors border border-transparent hover:border-slate-100">
                                    <input type="checkbox" checked={selectedAssets.has(asset.mac_address)} onChange={() => toggleAsset(asset.mac_address)} className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"/>
                                    <div className="ml-3 flex-1">
                                        <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{asset.name}</div>
                                        <div className="text-xs text-slate-400 flex justify-between">
                                            <span className="capitalize">{asset.type.replace('_', ' ')}</span>
                                            <span>{asset.battery}% 🔋</span>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-900 text-slate-300 text-xs mt-auto">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-100 flex items-center"><Info size={14} className="mr-1"/> API Config</span>
                            <button onClick={fetchData} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 border border-slate-700 transition-colors">Force Sync</button>
                        </div>
                        <label className="flex items-center justify-between mb-2">
                            <span>Auto-poll (Mock)</span>
                            <input type="checkbox" checked={isMocking} onChange={(e) => setIsMocking(e.target.checked)} className="accent-blue-500 cursor-pointer" />
                        </label>
                        <div className="flex items-center justify-between opacity-50">
                            <span>Interval (mins)</span>
                            <input type="number" value={fetchIntervalMins} onChange={(e) => setFetchIntervalMins(Number(e.target.value))} disabled={!isMocking} className="w-16 bg-slate-800 border border-slate-700 rounded p-1 text-center text-slate-100 focus:outline-none focus:border-blue-500"/>
                        </div>
                    </div>
                </aside>
                <main className="flex-1 bg-slate-100 relative overflow-hidden p-6">
                    <div ref={containerRef} className="w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative cursor-crosshair">
                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                        {hoveredNode && mode === 'path' && (
                            <div className="absolute pointer-events-none z-50 bg-slate-900/90 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-slate-700/50 transform -translate-x-1/2 -translate-y-full mb-3" style={{ left: hoveredNode.x, top: hoveredNode.y }}>
                                <div className="font-semibold mb-0.5">{hoveredNode.assetName}</div>
                                <div className="text-slate-300">{formatTimestamp(hoveredNode.timestamp)}</div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                                    <div className="border-[6px] border-transparent border-t-slate-900/90"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
