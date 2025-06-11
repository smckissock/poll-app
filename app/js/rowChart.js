
// Wrapper of dc.js rowChart
export class RowChart {
    constructor(attribute, title, config) {
        const id = `#${attribute}`
        const container = d3.select(id);
        container.select('.chart-title').remove();
        container.insert('div', ':first-child')
            .attr('class', 'chart-title')
            .text(title);
        
        this.dim = config.facts.dimension(dc.pluck(attribute));
        this.group = this.dim.group().reduceSum(dc.pluck("count"));
        
        dc.rowChart("#" + attribute)
            .dimension(this.dim)
            .group(this.group)
            .width(config.width)
            .height(this.group.size() * 24 + 24)
            .margins({ top: 0, right: 10, bottom: 20, left: 10 })
            .elasticX(true)
            .ordinalColors(["#83b4db"])  
            .label(d => `${d.key}  (${d.value.toLocaleString()})`)
            .labelOffsetX(5)
            .on('filtered', () => {
                config.updateFunction()
            })
            .xAxis().ticks(4).tickFormat(d3.format(".2s"));
    }
}
