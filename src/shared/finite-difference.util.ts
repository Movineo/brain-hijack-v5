export const calculateSentimentAcceleration = (data: number[], h: number = 1): number[] => {
    const acceleration: number[] = [];
    if (data.length < 3) return [];
    for (let i = 1; i < data.length - 1; i++) {
        const s_prev = data[i - 1];
        const s_curr = data[i];
        const s_next = data[i + 1];
        const secondDerivative = (s_next - (2 * s_curr) + s_prev) / (Math.pow(h, 2));
        acceleration.push(secondDerivative);
    }
    return acceleration;
};
