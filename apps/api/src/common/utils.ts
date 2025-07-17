
export function printableAddressList(list: string[]) {
    return list.reduce((acc: string[], addr, index) => {
        const lineIndex = Math.floor(index / 4);
        if (!acc[lineIndex]) acc[lineIndex] = '';
        acc[lineIndex] += (acc[lineIndex] ? ', ' : '') + addr;
        return acc;
    }, []);

}