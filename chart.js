//chart.js uses <canvas> element in HTML to draw charts and graphs
//use chartjs-node-canvs for creating it in node.js
import { ChartJSNodeCanvas} from 'chartjs-node-canvas' //v4

export async function graphData(match_data, dates, datalabel){

  const chart = new ChartJSNodeCanvas({width: 300, height: 200});

  //edit the settings of chart
  const settings = {
    type: 'bar',
    //the dates displayed as labels of every game
    data: {
      labels: [`${dates[4]['month']}/${dates[4]['day']}`,
              `${dates[3]['month']}/${dates[3]['day']}`,
              `${dates[2]['month']}/${dates[2]['day']}`,
              `${dates[1]['month']}/${dates[1]['day']}`,
              `${dates[0]['month']}/${dates[0]['day']}`,],
      
      //datasets (only 1) = the measured stat choice
      datasets: [{
        //label = kills, deaths, ...
        label: datalabel,
        //actual data of the chosen stat
        data: [match_data[4],match_data[3],match_data[2],match_data[1],match_data[0]],
        backgroundColor: 'rgba(141, 99, 255, 0.6)',
      }],
    },
    options: {
    //change the font color of the legend labels
      plugins: {
        legend: {labels: {color: 'rgba(255, 255, 255, 1)',  font: {size: 14}}}
      },
      //control styling and labels/ticks of x and y axis
      scales: {
        x: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
        y: {ticks: { color: 'rgba(255, 255, 255, 1)', font: {size: 14}}},
      }
    }
  }
  //sends the chart to image buffer in memory, but not saved in disk but buffer (make it a PNG)
  const buffer = await chart.renderToBuffer(settings);
  return buffer
}


