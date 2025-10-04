/**
 * Performance monitoring utility for tracking slow operations
 */

export class PerformanceMonitor {
    constructor(operationName) {
        this.operationName = operationName;
        this.startTime = process.hrtime.bigint();
        this.checkpoints = [];
    }

    checkpoint(name) {
        const currentTime = process.hrtime.bigint();
        const elapsed = Number(currentTime - this.startTime) / 1000000; // Convert to milliseconds

        this.checkpoints.push({
            name,
            elapsed: Math.round(elapsed * 100) / 100 // Round to 2 decimal places
        });

        return elapsed;
    }

    finish() {
        const totalTime = this.checkpoint('finish');

        if (totalTime > 1000) { // Log operations taking more than 1 second
            console.warn(`[PERFORMANCE] Slow operation detected: ${this.operationName} took ${totalTime}ms`);
            this.checkpoints.forEach(cp => {
                console.warn(`  - ${cp.name}: ${cp.elapsed}ms`);
            });
        }

        return {
            operationName: this.operationName,
            totalTime,
            checkpoints: this.checkpoints
        };
    }
}

export const withPerformanceMonitoring = (operationName, fn) => {
    return async (...args) => {
        const monitor = new PerformanceMonitor(operationName);

        try {
            const result = await fn(...args);
            monitor.finish();
            return result;
        } catch (error) {
            monitor.checkpoint('error');
            monitor.finish();
            throw error;
        }
    };
};