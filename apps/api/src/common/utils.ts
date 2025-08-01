export function printableAddressList(list: string[]): string[] {
    const maxToShow = 50;
    const trimmed = list.slice(0, maxToShow);

    const lines = trimmed.reduce((acc: string[], addr, index) => {
        const lineIndex = Math.floor(index / 4);
        if (!acc[lineIndex]) acc[lineIndex] = '';
        acc[lineIndex] += (acc[lineIndex] ? ', ' : '') + addr;
        return acc;
    }, []);

    if (list.length > maxToShow) {
        const remaining = list.length - maxToShow;
        lines.push(`… and ${remaining} more`);
    }

    return lines;
}
