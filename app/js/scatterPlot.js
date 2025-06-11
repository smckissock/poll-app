// Wrapper for dc.js ScatterPlot. Adds a regression line and R Squared.
export class ScatterPlot {
    constructor(xAttribute, yAttribute, title, config) {
        this.xAttribute = xAttribute;
        this.yAttribute = yAttribute;
        this.title = title;
        this.config = config;
        this.id = `#${xAttribute}-plot`;

        this.xValues = config.facts.all().map(d => +d[xAttribute]);
        this.yValues = config.facts.all().map(d => +d[yAttribute]);

        this.xDomain = this.computeDomain(this.xValues);
        this.yDomain = this.computeDomain(this.yValues);

        this.dim = config.facts.dimension(d => [+d[xAttribute], +d[yAttribute]]);
        this.group = this.dim.group().reduceSum(dc.pluck("count"));

        this.renderChart();
        this.overrideXAxisLabels();
        this.drawRegressionLine();
    }

    computeDomain(values) {
        const extent = d3.extent(values);
        const padding = (extent[1] - extent[0]) * 0.1;
        return [extent[0] - padding, extent[1] + padding];
    }

    renderChart() {
        const container = d3.select(this.id);
        container.select('.chart-title').remove();
        container.insert('div', ':first-child')
            .attr('class', 'chart-title')
            .text(this.title);

        this.chart = dc.scatterPlot(this.id)
            .dimension(this.dim)
            .group(this.group)
            .width(this.config.width)
            .height(this.config.height)
            .margins({ top: 20, right: 20, bottom: 40, left: 40 })
            .x(d3.scaleLinear().domain(this.xDomain))
            .y(d3.scaleLinear().domain(this.yDomain))
            .brushOn(false)
            .symbolSize(8)
            .clipPadding(10)
            .colors(["#83b4db"])
            .xAxisLabel(this.xAttribute)
            .yAxisLabel(this.yAttribute)
            .renderHorizontalGridLines(true)
            .renderVerticalGridLines(true)
            .on('filtered', () => {
                this.config.updateFunction();
            });
    }

    overrideXAxisLabels() {
        const getLabelOverrides = (attribute) => {
            // Ugh!
            if (attribute === "income_value") {
                return {
                    "1.0": "Low",
                    "2.0": "Lower-Middle",
                    "3.0": "Upper-Middle",
                    "4.0": "High"
                };
            }
            if (attribute === "education_level_value") {
                return {
                    "1.0": "High Sch.",
                    "2.0": "Some College",
                    "3.0": "Associate",
                    "4.0": "BA",
                    "5.0": "MA",
                    "6.0": "PhD"
                };
            }
            return null;
        };

        const labelMap = getLabelOverrides(this.xAttribute);
        if (!labelMap) return;

        const tickVals = Object.keys(labelMap).map(k => +k);
        this.chart.xAxis().tickValues(tickVals);

        this.chart.on('renderlet.xLabels', chart => {
            chart.selectAll('.x.axis .tick text')
                .text(d => labelMap[d.toFixed(1)] || d);
        });
    }

    drawRegressionLine() {

        function RSquared(xValues, yValues, slope, intercept) {
            const yMean = d3.mean(yValues);
            const ssTot = d3.sum(yValues.map(y => Math.pow(y - yMean, 2)));
            const ssRes = d3.sum(xValues.map((x, i) => {
                const predicted = slope * x + intercept;
                return Math.pow(yValues[i] - predicted, 2);
            }));
            return 1 - ssRes / ssTot;
        }

        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        this.chart.on('pretransition.trendline', debounce(chart => {
            const data = this.dim.top(Infinity);
            const xValues = data.map(d => +d[this.xAttribute]);
            const yValues = data.map(d => +d[this.yAttribute]);

            if (!xValues.length || !yValues.length) return;

            // Compute linear regression
            const xMean = d3.mean(xValues);
            const yMean = d3.mean(yValues);
            const covariance = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean)));
            const variance = d3.sum(xValues.map(x => Math.pow(x - xMean, 2)));
            const slope = covariance / variance;
            const intercept = yMean - slope * xMean;
            const r2 = RSquared(xValues, yValues, slope, intercept);

            const xScale = chart.x();
            const yScale = chart.y();
            const xMin = xScale.domain()[0];
            const xMax = xScale.domain()[1];
            const yMin = slope * xMin + intercept;
            const yMax = slope * xMax + intercept;

            const svg = d3.select(`${this.id} svg`);
            const innerG = svg.select('g.chart-body');

            const line = innerG.selectAll(".trendline").data([1]);
            line.enter()
                .append("line")
                .attr("class", "trendline")
                .merge(line)
                .transition()
                .duration(400)
                    .attr("x1", xScale(xMin))
                    .attr("y1", yScale(yMin))
                    .attr("x2", xScale(xMax))
                    .attr("y2", yScale(yMax))
                    .attr("stroke", "crimson")
                    .attr("stroke-width", 4)
                    .attr("stroke-dasharray", "4 2");

            // Add R2    
            svg.selectAll('.r2-label').data([r2])
                .join('text')
                .attr('class', 'r2-label')
                .attr('text-anchor', 'end')
                .attr('fill', '#555')
                .style('font-size', '12px')
                .transition()
                    .duration(300)
                    .attr('x', xScale(xMax) + 40) 
                    .attr('y', 10) 
                    .text(`R² = ${r2.toFixed(2)}`)
        }, 100));
    }
}
