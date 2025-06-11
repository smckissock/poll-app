// Wrapper for dc.js BoxPlot
export class BoxPlot {
    constructor(attribute, measure, title, config) {
        
        this.dim = config.facts.dimension(dc.pluck(attribute));

        this.group = this.dim.group().reduce(
            (p, v) => {
                const value = +v[measure];
                if (!isNaN(value)) {
                    p.values.push(value);
                }
                return p;
            },
            (p, v) => {
                const value = +v[measure];
                if (!isNaN(value)) {
                    const index = p.values.indexOf(value);
                    if (index > -1) {
                        p.values.splice(index, 1);
                    }
                }
                return p;
            },
            () => ({ values: [] })
        );

        const id = `#${attribute}-box-plot`
        const container = d3.select(id);
        container.select('.chart-title').remove();
        container.insert('div', ':first-child')
            .attr('class', 'chart-title')
            .text(title);

        this.chart = dc.boxPlot(id)
            .dimension(this.dim)
            .group(this.group)
            .valueAccessor(d => d.value.values)  
            .width(config.width)
            .height(300)
            .margins({ top: 20, right: 20, bottom: 40, left: 40 })
            .colors(["#83b4db"])
            .boxPadding(0.8)
            .outerPadding(0.5)
            .on('filtered', () => {
                if (typeof config.updateFunction === 'function') {
                    config.updateFunction();
                }
            });

        this.chart.yAxis().tickFormat(d3.format(".2f"));

        // Warn if group values are not valid
        this.chart.on('pretransition', () => {
            const bad = this.group.all().filter(g => !Array.isArray(g.value?.values));
            if (bad.length > 0) {
                console.warn("Invalid boxplot group values:", bad);
            }
        });
    }
}
