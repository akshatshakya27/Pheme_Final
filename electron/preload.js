const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  apiCall: (method, endpoint, data) => ipcRenderer.invoke('api-call', method, endpoint, data),

  login: (email, password) =>
    ipcRenderer.invoke('api-call', 'POST', '/api/login', {
      email,
      password,
      role: 'student',
      __form: true,
    }),

  getExams: (token) =>
    ipcRenderer.invoke('api-call', 'GET', '/api/desktop-exam/my-exams', {
      token,
    }),

  startExamSession: (examId, token) =>
    ipcRenderer.invoke('api-call', 'POST', '/api/desktop-exam/start-session', {
      exam_id: examId,
      token,
    }),

  submitExam: (sessionId, answers, token) =>
    ipcRenderer.invoke('api-call', 'POST', '/api/desktop-exam/submit', {
      session_id: sessionId,
      answers,
      token,
    }),

  logProctorEvent: (sessionId, eventType, data, token) =>
    ipcRenderer.invoke('api-call', 'POST', '/api/desktop-exam/proctor-event', {
      session_id: sessionId,
      event_type: eventType,
      event_data: data,
      token,
    }),

  checkSafeExamGuard: () => ipcRenderer.invoke('check-safe-exam-guard'),

  setExamFullscreen: (enabled) => ipcRenderer.invoke('set-exam-fullscreen', Boolean(enabled)),

  logout: () => ipcRenderer.invoke('logout'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});
