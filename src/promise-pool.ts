export type PromisePool = ReturnType<typeof promisePool>;

type Tasker<T> = ((index: number) => Promise<T>) | (() => Promise<T>);
export const promisePool = <T>(taskers: Tasker<T | void>[], concurrency = 5, infinite = false): {
    promise: Promise<(T | undefined)[]>,
    addTask: ((task: Tasker<T>) => Promise<T>)
} => {
    const results: (T | undefined)[] = [];
    const currentTasks: (Promise<T | void> | undefined)[] = []
    let iTask = 0;
    let resolve, reject

    const updateCurrentTasks = () => {
        for (let i = 0; i < concurrency; i++) {
            if (!currentTasks[i]) {
                const task = taskers[iTask];
                const thisTaskIndex = iTask;

                if (!task) {
                    if (!infinite) {
                        for (let j = 0; j < concurrency; j++)
                            if (currentTasks[j]) return;

                        resolve(results)
                    }
                    break;
                }
                iTask++;
                console.log("Task", thisTaskIndex, "starting at slot", i)
                currentTasks[i] = Promise.resolve(task(thisTaskIndex)).then(res => {
                    results[thisTaskIndex] = res!;
                    delete currentTasks[i];
                    console.log("Task at slot", i, "finished")
                    updateCurrentTasks();
                    return res
                })
            }
        }
    }

    const promise = new Promise<T[]>((rs, rj) => {
        resolve = rs;
        reject = rj
        updateCurrentTasks()
    })

    return {
        promise,
        addTask(task) {
            return new Promise<T>((rs, rj) => {
                taskers.push(i => task(i).catch(e => rj(e)).then(v => rs(v as unknown as T)))
                updateCurrentTasks()
            })
        }
    }
}