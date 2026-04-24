import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Camera, MessageSquare, Send, Monitor } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface LiveFrameResponse {
	session_id: string;
	exam_id: string;
	frame: string | null;
	updated_at: string | null;
}

interface MessageItem {
	id: string;
	session_id: string;
	sender: string;
	message: string;
	timestamp: string;
}

function getAuthTokenFromStorage(): string | null {
	const stored = localStorage.getItem('proctora-auth');
	if (!stored) return null;

	try {
		const parsed = JSON.parse(stored);
		return parsed?.state?.token || null;
	} catch {
		return null;
	}
}

function buildSignalingWsUrl(sessionId: string, token: string, role: 'student' | 'proctor'): string {
	const envApiUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
	const apiBase = envApiUrl || api.defaults.baseURL || '/api';
	const isAbsolute = /^https?:\/\//i.test(apiBase);
	const normalizedApiBase = isAbsolute
		? apiBase
		: (window.location.protocol === 'file:' || !window.location.host)
			? `http://127.0.0.1:8000${apiBase.startsWith('/') ? '' : '/'}${apiBase}`
			: `${window.location.origin}${apiBase.startsWith('/') ? '' : '/'}${apiBase}`;
	const base = new URL(normalizedApiBase);
	const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsPath = `${base.pathname.replace(/\/$/, '')}/proctoring/ws/${encodeURIComponent(sessionId)}`;
	return `${wsProtocol}//${base.host}${wsPath}?token=${encodeURIComponent(token)}&role=${role}`;
}

export default function ProctorLivePanelPage() {
	const { sessionId = '' } = useParams<{ sessionId: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [frame, setFrame] = useState<LiveFrameResponse | null>(null);
	const [messages, setMessages] = useState<MessageItem[]>([]);
	const [messageText, setMessageText] = useState('');
	const [loading, setLoading] = useState(true);
	const [isLive, setIsLive] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isWebRtcLive, setIsWebRtcLive] = useState(false);
	const [webRtcStatus, setWebRtcStatus] = useState<'idle' | 'ws-connected' | 'offer-received' | 'answer-sent' | 'stream-live' | 'failed'>('idle');
	const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
	const remoteStreamRef = useRef<MediaStream | null>(null);
	const signalingWsRef = useRef<WebSocket | null>(null);
	const webrtcPcRef = useRef<RTCPeerConnection | null>(null);

	const examId = searchParams.get('examId') || '';
	const studentId = searchParams.get('studentId') || '';
	const studentName = searchParams.get('studentName') || 'Student';
	const proctoringMode = searchParams.get('mode') || 'one-way';

	const title = useMemo(() => studentName, [studentName]);

	useEffect(() => {
		if (!isWebRtcLive || !remoteVideoRef.current || !remoteStreamRef.current) return;
		remoteVideoRef.current.srcObject = remoteStreamRef.current;
	}, [isWebRtcLive]);

	useEffect(() => {
		if (!sessionId) return undefined;

		const token = getAuthTokenFromStorage();
		if (!token) return undefined;

		const wsUrl = buildSignalingWsUrl(sessionId, token, 'proctor');
		const ws = new WebSocket(wsUrl);
		signalingWsRef.current = ws;

		const ensurePeerConnection = () => {
			if (webrtcPcRef.current) return webrtcPcRef.current;

			const pc = new RTCPeerConnection({
				iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
			});

			pc.onicecandidate = (event) => {
				if (!event.candidate || ws.readyState !== WebSocket.OPEN) return;
				ws.send(
					JSON.stringify({
						type: 'ice-candidate',
						payload: event.candidate.toJSON(),
					})
				);
			};

			pc.ontrack = (event) => {
				const [stream] = event.streams;
				if (!stream) return;
				remoteStreamRef.current = stream;
				if (remoteVideoRef.current) {
					remoteVideoRef.current.srcObject = stream;
				}
				setIsWebRtcLive(true);
				setIsLive(true);
			};

			webrtcPcRef.current = pc;
			return pc;
		};

		ws.onopen = () => {
			setWebRtcStatus('ws-connected');
			ws.send(JSON.stringify({ type: 'webrtc-ready' }));
		};

		ws.onmessage = async (event) => {
			try {
				const message = JSON.parse(event.data);

				if (message.type === 'webrtc-ready' && message.from_role === 'student') {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: 'webrtc-ready' }));
					}
					return;
				}

				if (message.type === 'offer') {
					setWebRtcStatus('offer-received');
					const pc = ensurePeerConnection();
					const offer = message.payload;
					if (!offer) return;

					await pc.setRemoteDescription(new RTCSessionDescription(offer));
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);

					if (ws.readyState === WebSocket.OPEN && pc.localDescription) {
						ws.send(
							JSON.stringify({
								type: 'answer',
								payload: pc.localDescription,
							})
						);
						setWebRtcStatus('answer-sent');
					}
					return;
				}

				if (message.type === 'ice-candidate') {
					const pc = ensurePeerConnection();
					const candidate = message.payload;
					if (candidate) {
						await pc.addIceCandidate(new RTCIceCandidate(candidate));
					}
				}
			} catch {
				setWebRtcStatus('failed');
			}
		};

		return () => {
			setIsWebRtcLive(false);
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = null;
			}
			setWebRtcStatus('idle');
			remoteStreamRef.current = null;
			try {
				ws.close();
			} catch {
			}
			signalingWsRef.current = null;
			if (webrtcPcRef.current) {
				webrtcPcRef.current.close();
				webrtcPcRef.current = null;
			}
		};
	}, [sessionId]);

	useEffect(() => {
		let cancelled = false;

		const refresh = async () => {
			try {
				const [frameResponse, messageResponse] = await Promise.all([
					api.get<LiveFrameResponse>(`/proctoring/live-frame/${sessionId}`),
					api.get<{ messages: MessageItem[] }>(`/proctoring/messages/${sessionId}`),
				]);

				if (cancelled) return;
				setFrame(frameResponse.data);
				setMessages(messageResponse.data.messages || []);
				setIsLive(Boolean(frameResponse.data.frame));
				setError(null);
			} catch (requestError: any) {
				if (!cancelled) {
					setError(requestError?.response?.data?.detail || 'Unable to load live session data.');
					setIsLive(false);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		refresh();
		const interval = window.setInterval(refresh, 500);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [sessionId]);

	const handleSendMessage = async () => {
		const trimmed = messageText.trim();
		if (!trimmed) return;

		await api.post('/proctoring/messages', {
			session_id: sessionId,
			message: trimmed,
		});
		setMessageText('');
	};

	return (
		<div className="min-h-screen bg-background text-foreground p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div>
						<p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Proctoring</p>
						<h1 className="text-2xl font-bold">Live Panel</h1>
						<p className="text-sm text-muted-foreground mt-1">{title} • Session {sessionId || '-'} • Exam {examId || '-'}</p>
					</div>
					<Button variant="outline" onClick={() => navigate('/proctor')}>
						Back to Dashboard
					</Button>
				</div>

				{error && (
					<Card className="border-red-200 bg-red-50">
						<CardContent className="pt-6 flex items-center gap-3 text-red-700">
							<AlertCircle className="h-5 w-5" />
							<p className="text-sm">{error}</p>
						</CardContent>
					</Card>
				)}

				<div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
					<Card className="overflow-hidden">
						<CardContent className="p-0">
							<div className="aspect-video bg-black relative flex items-center justify-center">
								{isWebRtcLive ? (
									<video ref={remoteVideoRef} autoPlay playsInline muted={false} className="h-full w-full object-cover" />
								) : loading && !frame?.frame ? (
									<p className="text-sm text-white/70">Loading live camera...</p>
								) : frame?.frame ? (
									<img
										key={frame.updated_at || frame.frame}
										src={frame.frame}
										alt="Student live camera"
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="text-center text-white/70">
										<Camera className="h-10 w-10 mx-auto mb-2" />
										<p className="text-sm">No camera frame available yet.</p>
									</div>
								)}
								<div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
									<Monitor className="h-3.5 w-3.5" />
									{isWebRtcLive ? 'WebRTC live' : isLive ? 'Snapshot live' : 'Waiting for feed'}
								</div>
								<div className="absolute top-11 left-3 rounded bg-black/50 px-2 py-1 text-[11px] text-white">
									WebRTC: {webRtcStatus}
								</div>
								<div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
									<span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
									{proctoringMode === 'two-way' ? 'Two-way mode' : 'One-way mode'}
								</div>
								<div className="absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-[11px] text-white">
									{frame?.updated_at ? `Updated ${new Date(frame.updated_at).toLocaleTimeString()}` : 'Awaiting first frame'}
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="pt-6 space-y-4">
							<div>
								<p className="text-sm font-semibold mb-1">Send Message</p>
								<p className="text-xs text-muted-foreground">Message the student during the session.</p>
							</div>
							<div className="flex gap-2">
								<Input
									placeholder="Type a message..."
									value={messageText}
									onChange={(event) => setMessageText(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											void handleSendMessage();
										}
									}}
								/>
								<Button onClick={() => void handleSendMessage()} disabled={!messageText.trim()}>
									<Send className="h-4 w-4" />
								</Button>
							</div>

							<div className="border-t pt-4">
								<div className="flex items-center gap-2 mb-3 text-sm font-semibold">
									<MessageSquare className="h-4 w-4" />
									Messages ({messages.length})
								</div>
								<div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
									{messages.length === 0 ? (
										<p className="text-sm text-muted-foreground">No messages sent yet.</p>
									) : (
										messages.map((message) => (
											<div key={message.id} className="rounded-lg border border-border bg-secondary/40 p-3">
												<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
													<span className="font-semibold text-foreground">{message.sender}</span>
													<span>{new Date(message.timestamp).toLocaleTimeString()}</span>
												</div>
												<p className="text-sm">{message.message}</p>
											</div>
										))
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}