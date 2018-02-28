import React from 'react';
import { PointModel } from '../Common';

export class DefaultLinkWidget extends React.Component {
  static defaultProps = {
    color: 'black',
    width: 3,
    link:null,
    engine: null,
    smooth: false,
    diagramEngine: null
  };

  constructor(props) {
    super(props);
    this.state = {
      selected: false
    };
  }

  generatePoint(pointIndex) {
    const { link } = this.props;
    const uiCircleProps = {
      className: `point pointui${(link.points[pointIndex].isSelected() ? ' selected' : '')}`,
      cx: link.points[pointIndex].x,
      cy: link.points[pointIndex].y,
      r: 5,
    };
    const circleProps = {
      className: 'point',
      'data-linkid': link.id,
      'data-id': link.points[pointIndex].id,
      cx: link.points[pointIndex].x,
      cy: link.points[pointIndex].y,
      r: 15,
      opacity: 0,
      onMouseLeave: () => this.setState({ selected: false }),
      onMouseEnter: () => this.setState({ selected: true }),
    };

    return (
      <g key={`point-${link.points[pointIndex].id}`}>
        <circle {...uiCircleProps}/>
        <circle {...circleProps}/>
      </g>
    );
  }

  generateLabel() {
		const canvas = this.props.diagramEngine.canvas;
		return (
			<foreignObject className="link-label" width={canvas.offsetWidth} height={canvas.offsetHeight}>
				<div ref={label => (this.refLabel = label)}>{this.props.link.label}</div>
			</foreignObject>
		);
  }
  
  findPathAndRelativePositionToRenderLabel = () => {
		// an array to hold all path lengths, making sure we hit the DOM only once to fetch this information
		const lengths = this.refPaths.map(path => path.getTotalLength());
    console.log(lengths);
		// calculate the point where we want to display the label
		let labelPosition = lengths.reduce((previousValue, currentValue) => previousValue + currentValue, 0) / 2;

		// find the path where the label will be rendered and calculate the relative position
		let pathIndex = 0;
		while (pathIndex < this.refPaths.length) {
			if (labelPosition - lengths[pathIndex] < 0) {
				return {
					path: this.refPaths[pathIndex],
					position: labelPosition
				};
			}

			// keep searching
			labelPosition -= lengths[pathIndex];
			pathIndex++;
		}
  };
  
  calculateLabelPosition = () => {
		if (!this.refLabel) {
			// no label? nothing to do here
			return;
		}

		const { path, position } = this.findPathAndRelativePositionToRenderLabel();

		const labelDimensions = {
			width: this.refLabel.offsetWidth,
			height: this.refLabel.offsetHeight
    };
    
    const pathCentre = path.getPointAtLength(position);
    console.log("PATH CENTRe");
    console.log(pathCentre);
		const labelCoordinates = {
			x: pathCentre.x,
			y: pathCentre.y
		};

		this.refLabel.setAttribute("style", `transform: translate(${labelCoordinates.x}px, ${labelCoordinates.y}px);`);
  };
  
  componentDidUpdate() {
		window.requestAnimationFrame(this.calculateLabelPosition);
	}

	componentDidMount() {
		window.requestAnimationFrame(this.calculateLabelPosition);
	}

  generateLink(extraProps) {
    const { link, width, color } = this.props;
    const { selected } = this.state;
    const bottom = (
      <path
        className={(selected || link.isSelected()) ? 'selected' : ''}
        strokeWidth={width}
        stroke={color}
        ref={path => path && this.refPaths.push(path)}
        {...extraProps}
      />
    );

    const top = (
      <path
        strokeLinecap={'round'}
        data-linkid={link.getID()}
        stroke={color}
        strokeOpacity={selected ? 0.1 : 0}
        strokeWidth={20}
        onMouseLeave={() => this.setState({ selected: false })}
        onMouseEnter={() => this.setState({ selected: true })}
        onContextMenu={event => {
          event.preventDefault();
          this.props.link.remove();
        }}
        {...extraProps}
      />
    );

    return (
      <g key={`link-${extraProps.id}`}>
        {bottom}
        {top}
      </g>
    );
  }

  drawLine() {
    const { link, diagramEngine, pointAdded } = this.props;
    const { points } = link;
    const paths = [];

    // If the points are too close, just draw a straight line
    const margin = (Math.abs(points[0].x - points[1].x) < 50) ? 5 : 50;

    let pointLeft = points[0];
    let pointRight = points[1];

    paths.push(this.generateLink({
      id: 0,
      onMouseDown: (event) => {
        if (!event.shiftKey && link.canCreatePoints) {
          var point = new PointModel(link, diagramEngine.getRelativeMousePoint(event));
          point.setSelected(true);
          this.forceUpdate();
          link.addPoint(point, 1);
          pointAdded(point, event);
        }
      },
      d: ` M${pointLeft.x} ${pointLeft.y} C${pointLeft.x + margin} ${pointLeft.y} ${pointRight.x - margin} ${pointRight.y} ${pointRight.x} ${pointRight.y}` // eslint-disable-line
    }));

    if (link.targetPort === null) {
      paths.push(this.generatePoint(1));
    }

    return paths;
  }

  drawAdvancedLine() {
    const { link, smooth, diagramEngine, pointAdded } = this.props;
    const { points } = link;
    const ds = [];

    if (smooth) {
      ds.push(
        ` M${points[0].x} ${points[0].y} C ${points[0].x + 50} ${points[0].y} ${points[1].x} ${points[1].y} ${points[1].x} ${points[1].y}` // eslint-disable-line
      );

      let i;
      for (i = 1; i < points.length - 2; i++) {
        ds.push(` M ${points[i].x} ${points[i].y} L ${points[i + 1].x} ${points[i + 1].y}`);
      }

      ds.push(
        ` M${points[i].x} ${points[i].y} C ${points[i].x} ${points[i].y} ${points[i + 1].x - 50} ${points[i + 1].y} ${points[i + 1].x} ${points[i + 1].y}` // eslint-disable-line
      );
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        ds.push(` M ${points[i].x} ${points[i].y} L ${points[i + 1].x} ${points[i + 1].y}`);
      }
    }

    const paths = ds.map((data, index) => this.generateLink({
      id: index,
      d: data,
      'data-linkid': link.id,
      'data-point': index,
      onMouseDown: event => {
        if (!event.shiftKey && link.canCreatePoints) {
          const point = new PointModel(link, diagramEngine.getRelativeMousePoint(event));
          point.setSelected(true);
          this.forceUpdate();
          link.addPoint(point, index + 1);
          pointAdded(point, event);
        }
      }
    }));

    // Render the circles
    for (let i = 1; i < points.length - 1; i++) {
      paths.push(this.generatePoint(i));
    }

    if (link.targetPort === null) {
      paths.push(this.generatePoint(points.length - 1));
    }

    return paths;
  }

  render() {
    const { points } = this.props.link;
    let paths = [];

    // Draw the line
    if (points.length === 2) {
      paths = this.drawLine();
    } else {
      paths = this.drawAdvancedLine();
    }

    this.refLabel = null;
    this.refPaths = [];
    
    return (
      <g>
        {paths}
        {this.props.link.label && this.generateLabel()}
      </g>
    );
  }
}
