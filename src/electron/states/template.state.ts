import {
  ComponentSymbol,
  DirectiveSymbol,
  WorkspaceSymbols,
  TemplateNode,
} from 'ngast';
import { State } from './state';
import {
  VisualizationConfig,
  Metadata,
  getId,
  Node,
  SymbolTypes,
  isThirdParty, Edge
} from '../../shared/data-format';
import {
  getDirectiveMetadata,
  getElementMetadata,
} from '../formatters/model-formatter';
import { DirectiveState } from './directive.state';

interface NodeMap {
  [id: string]: ComponentSymbol | DirectiveSymbol | TemplateNode;
}

const TemplateId = 'template';

export class TemplateState extends State {
  private symbols: NodeMap = {};

  constructor(context: WorkspaceSymbols, protected directive: ComponentSymbol) {
    super(getId(directive), context);
  }

  getMetadata(id: string): Metadata | null {
    const s = this.symbols[id];
    if (s) {
      if (s instanceof ComponentSymbol || s instanceof DirectiveSymbol) {
        // We can't analyze well symbols coming from node modules.
        return isThirdParty(s) ? null : getDirectiveMetadata(s);
      } else {
        return getElementMetadata(s);
      }
    }
    return null;
  }

  nextState(id: string): State | null {
    if (id === this.symbolId) {
      return null;
    }
    const symbol = this.symbols[id];
    if (!symbol) {
      return null;
    }
    // ngtsc does not allow us to resolve many of the properties
    // we need for third-party symbols so we don't allow the navigation.
    if ((symbol instanceof ComponentSymbol || symbol instanceof DirectiveSymbol) &&
        isThirdParty(symbol)) {
      return null;
    }
    if (symbol instanceof ComponentSymbol) {
      return new DirectiveState(this.context, symbol);
    } else {
      return null;
    }
  }

  getData(): VisualizationConfig<any> {
    const label = `${this.directive.name}'s Template`;
    const nodes: Node<ComponentSymbol>[] = [
      {
        id: TemplateId,
        label,
        type: {
          type: SymbolTypes.Meta,
          angular: false,
        },
      },
    ];
    const edges: Edge[] = [];
    this.addTemplateNodes(nodes, edges);
    return {
      title: label,
      graph: {
        nodes: nodes.map(node => ({
          id: node.id,
          label: node.label,
          type: node.type
        })),
        edges,
      },
    };
  }

  private addTemplateNodes(
    resNodes: Node<ComponentSymbol | TemplateNode>[],
    edges: Edge[]
  ) {
    const rootNodes = this.directive.getTemplateAst();
    if (!rootNodes) {
      return;
    }
    let currentNode = 0;
    const addNodes = (nodes: TemplateNode[], parentNodeId: string) => {
      nodes.forEach((n) => {
        if (!n) return;

        currentNode += 1;
        const nodeId = 'el-' + currentNode.toString();
        edges.push({
          from: parentNodeId,
          to: nodeId,
        });
        const node = {
          id: nodeId,
          label: n.name,
          data: n,
          type: {
            angular: false,
            type: n.directives.length
              ? SymbolTypes.HtmlElementWithDirective
              : SymbolTypes.HtmlElement,
          },
        };
        this.symbols[nodeId] = n;
        if (n.component) {
          this.symbols[nodeId] = n.component;
          node.type.type = SymbolTypes.Component;
        }
        resNodes.push(node);
        addNodes(
          n.children,
          nodeId
        );
      });
    };
    addNodes(
      rootNodes,
      TemplateId
    );
  }
}
