// test-logger.js - Shared logging functionality
class TestLogger {
    constructor() {
        this.logs = [];
        this.testSessionId = 'session_' + Date.now();
        this.startTime = new Date();
    }

    log(message, type = 'info', data = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: type,
            message: message,
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.logs.push(logEntry);
        
        // Also log to browser console
        const consoleMethod = type === 'error' ? 'error' : type === 'success' ? 'log' : 'info';
        console[consoleMethod](`[${logEntry.timestamp}] ${message}`, data || '');

        // Save to localStorage for persistence
        this.saveToStorage();
        
        return logEntry;
    }

    saveToStorage() {
        const sessionData = {
            sessionId: this.testSessionId,
            startTime: this.startTime,
            logs: this.logs
        };
        localStorage.setItem('trustledger_test_logs', JSON.stringify(sessionData));
    }

    downloadLogs() {
        const sessionData = {
            sessionId: this.testSessionId,
            startTime: this.startTime,
            endTime: new Date(),
            logs: this.logs,
            summary: this.getSummary()
        };

        const blob = new Blob([JSON.stringify(sessionData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trustledger_test_${this.testSessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadCSV() {
        const csvHeaders = ['Timestamp', 'Type', 'Message', 'Data', 'URL'];
        const csvRows = this.logs.map(log => [
            log.timestamp,
            log.type,
            `"${log.message.replace(/"/g, '""')}"`,
            log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : '',
            log.url
        ]);

        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trustledger_test_${this.testSessionId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getSummary() {
        const total = this.logs.length;
        const successes = this.logs.filter(log => log.type === 'success').length;
        const errors = this.logs.filter(log => log.type === 'error').length;
        const warnings = this.logs.filter(log => log.type === 'warning').length;

        return {
            totalLogs: total,
            successes: successes,
            errors: errors,
            warnings: warnings,
            successRate: total > 0 ? ((successes / total) * 100).toFixed(2) + '%' : '0%'
        };
    }

    clearLogs() {
        this.logs = [];
        localStorage.removeItem('trustledger_test_logs');
    }

    loadFromStorage() {
        const stored = localStorage.getItem('trustledger_test_logs');
        if (stored) {
            const sessionData = JSON.parse(stored);
            this.logs = sessionData.logs || [];
            this.testSessionId = sessionData.sessionId || this.testSessionId;
            this.startTime = new Date(sessionData.startTime) || this.startTime;
        }
    }
}

// Create global logger instance
window.testLogger = new TestLogger();
window.testLogger.loadFromStorage();