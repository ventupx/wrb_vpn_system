interface EndpointNode {
  id: number;
  name: string;
  type: string;
  ratio: string;
  traffic_used?: number;
  connect_host?: string;
  port_range?: string;
  config?: string;
  show_order: number;
  display_num?: number;
  fallback_group?: number;
  display_protocol?: string;
  allowed_out?: string;
}

interface EndpointsResponse {
  code: number;
  message: string;
  data: {
    inbounds: EndpointNode[];
    outbounds: EndpointNode[];
  }
}

export type { EndpointNode, EndpointsResponse }; 