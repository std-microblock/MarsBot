export const profiler = (name) => {
    const startTime = performance.now()
    const obj: {
        [name: string]: number
    } = {}
    let currentName = null;
    let lastTime = startTime
    return {
        start(name) {
            if (currentName) {
                obj[currentName] ??= 0
                obj[currentName] += performance.now() - lastTime;
            }
            lastTime = performance.now();
            currentName = name;
        },
        end() {
            obj[currentName!] ??= 0
            obj[currentName!] += performance.now() - lastTime;
            currentName = null;
        },
        endPrint() {
            obj[currentName!] ??= 0
            obj[currentName!] += performance.now() - lastTime;
            currentName = null;

            const totalTime = Object.values(obj).reduce((p, c) => p + c, 0);
            const text = (`== Profiler == ${name}\n${Object.entries(obj).sort((a, b) => a[1] - b[1]).map(([name, time]) => `${(time / totalTime * 100).toFixed(1)}% ${name}: ${time.toFixed(1)}ms`).join('\n')}\n== Total: ${totalTime.toFixed(1)}ms ==`)
            console.log(text)
            return text
        }
    }
}

export type Profiler = ReturnType<typeof profiler>