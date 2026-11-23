import { useState, useMemo, useCallback } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";

// ─── Data ────────────────────────────────────────────────────────────────────

type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

interface StatusCode {
  code: number;
  name: string;
  description: string;
  detail: string;
  rfc?: string;
  rfcUrl?: string;
}

const STATUS_CODES: Record<StatusClass, StatusCode[]> = {
  "1xx": [
    {
      code: 100,
      name: "Continue",
      description: "Server has received the request headers; client should proceed.",
      detail: "The client should continue with its request. This interim response indicates that everything so far is OK and the client should continue the request, or ignore the response if the request is already finished.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.2.1",
    },
    {
      code: 101,
      name: "Switching Protocols",
      description: "Server is switching to the protocol specified in the Upgrade header.",
      detail: "Sent in response to an Upgrade request header from the client and indicates the protocol the server is switching to. Used for WebSocket upgrades.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.2.2",
    },
    {
      code: 102,
      name: "Processing",
      description: "Server has received and is processing the request (WebDAV).",
      detail: "An interim response to inform the client that the server has accepted the complete request but has not yet completed it. Used in WebDAV to prevent timeouts on long-running requests.",
      rfc: "RFC 2518",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc2518#section-10.1",
    },
    {
      code: 103,
      name: "Early Hints",
      description: "Preload hints before the final response is ready.",
      detail: "Used to return some response headers before the final HTTP message. Allows the client to start preloading resources while the server prepares a response.",
      rfc: "RFC 8297",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc8297",
    },
  ],
  "2xx": [
    {
      code: 200,
      name: "OK",
      description: "Request succeeded. Response body contains the result.",
      detail: "The request has succeeded. The meaning of a success varies depending on the HTTP method: GET: resource has been fetched; POST: the resource describing the result of the action is transmitted; PUT/PATCH: the resource has been updated; HEAD: headers are identical to a GET for the same resource.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.1",
    },
    {
      code: 201,
      name: "Created",
      description: "Request succeeded and a new resource was created.",
      detail: "The request has been fulfilled, resulting in the creation of a new resource. The new resource is effectively created before this response is sent back and the new resource is returned in the body of the message, its location being either the URL of the request, or the content of the Location header.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.2",
    },
    {
      code: 202,
      name: "Accepted",
      description: "Request accepted for processing but processing is not complete.",
      detail: "The request has been received but not yet acted upon. It is non-committal, meaning the server cannot act on the request later. Useful for async processing where another process or server handles the request.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.3",
    },
    {
      code: 203,
      name: "Non-Authoritative Information",
      description: "Response is from a transforming proxy, not the origin server.",
      detail: "The returned metadata is not exactly the same as is available from the origin server. Used by proxies that have modified the response.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.4",
    },
    {
      code: 204,
      name: "No Content",
      description: "Request succeeded but there is no content to send in the response.",
      detail: "There is no content to send for this request, but the headers may be useful. The user agent may update its cached headers for this resource with the new ones. Common response for DELETE requests.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.5",
    },
    {
      code: 205,
      name: "Reset Content",
      description: "Request succeeded; client should reset the document view.",
      detail: "Tells the user agent to reset the document which sent this request. Used after a form submission to clear the input fields.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.6",
    },
    {
      code: 206,
      name: "Partial Content",
      description: "Server is delivering part of the resource due to a Range header.",
      detail: "Used when the client sends a Range header to request only part of a resource. The response contains only the requested range. Used for resumable downloads and streaming media.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.3.7",
    },
    {
      code: 207,
      name: "Multi-Status",
      description: "Multiple operations; response body is XML with per-resource status (WebDAV).",
      detail: "The message body contains an XML document with the status of multiple independent operations. Used in WebDAV for batch operations.",
      rfc: "RFC 4918",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc4918#section-11.1",
    },
    {
      code: 208,
      name: "Already Reported",
      description: "Members already enumerated in a preceding part of the response (WebDAV).",
      detail: "Used inside a DAV: propstat response element to avoid enumerating the internal members of multiple bindings to the same collection repeatedly.",
      rfc: "RFC 5842",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc5842#section-7.1",
    },
    {
      code: 226,
      name: "IM Used",
      description: "Server has fulfilled a GET request with delta encoding applied.",
      detail: "The server has fulfilled a GET request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance. Used with HTTP Delta Encoding.",
      rfc: "RFC 3229",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc3229#section-10.4.1",
    },
  ],
  "3xx": [
    {
      code: 300,
      name: "Multiple Choices",
      description: "Multiple possible responses; client should choose one.",
      detail: "The request has more than one possible response. The user agent or user should choose one of them. There is no standardized way to choose, but HTML links to the possibilities are recommended.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.1",
    },
    {
      code: 301,
      name: "Moved Permanently",
      description: "Resource URL has permanently changed. Future requests should use the new URL.",
      detail: "The URL of the requested resource has been changed permanently. The new URL is given by the Location header. Browsers cache this redirect. Search engines update their links to the new URL.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.2",
    },
    {
      code: 302,
      name: "Found",
      description: "Resource temporarily at a different URL. Future requests should use the original URL.",
      detail: "Tells the client to look at another URL. The 302 response method is not changed (POST stays POST), though some clients change to GET. Use 303 or 307 for explicit method behavior.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.3",
    },
    {
      code: 303,
      name: "See Other",
      description: "Redirect to another resource with a GET request.",
      detail: "The server sends this response to direct the client to get the requested resource at another URI with a GET request. Usually sent in response to a POST or PUT request.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.4",
    },
    {
      code: 304,
      name: "Not Modified",
      description: "Resource has not changed since the last request. Use cached version.",
      detail: "Tells the client the response has not been modified, so the client can continue to use the same cached version of the response. Sent when the request uses If-Modified-Since or If-None-Match headers.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.5",
    },
    {
      code: 307,
      name: "Temporary Redirect",
      description: "Temporary redirect preserving the HTTP method.",
      detail: "The server sends this response to direct the client to get the requested resource at another URI with the same method as the prior request. Unlike 302, the HTTP method must not change.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.8",
    },
    {
      code: 308,
      name: "Permanent Redirect",
      description: "Permanent redirect preserving the HTTP method.",
      detail: "The resource is now permanently located at another URI, specified by the Location header. Unlike 301, the HTTP method must not change. Future requests should use the new URI.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.4.9",
    },
  ],
  "4xx": [
    {
      code: 400,
      name: "Bad Request",
      description: "Server cannot process the request due to a client error.",
      detail: "The server cannot or will not process the request due to something that is perceived to be a client error: malformed request syntax, invalid request message framing, or deceptive request routing.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.1",
    },
    {
      code: 401,
      name: "Unauthorized",
      description: "Authentication required. No valid credentials were provided.",
      detail: "The client must authenticate itself to get the requested response. The server must include a WWW-Authenticate header with the challenge. Despite the name, this means 'unauthenticated': the client lacks valid credentials.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.2",
    },
    {
      code: 402,
      name: "Payment Required",
      description: "Reserved for future use. Sometimes used for payment-gated resources.",
      detail: "Originally intended for digital payment systems, this status code is rarely used. Some APIs use it to indicate that a subscription or payment is required to access the resource.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.3",
    },
    {
      code: 403,
      name: "Forbidden",
      description: "Client is authenticated but does not have permission to access the resource.",
      detail: "The client does not have access rights to the content; it is unauthorized, so the server is refusing to give the proper response. Unlike 401, the client's identity is known to the server but lacks required permissions.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.4",
    },
    {
      code: 404,
      name: "Not Found",
      description: "The server cannot find the requested resource.",
      detail: "The server cannot find the requested resource. The URL is not recognized. In an API, this can also mean the endpoint is valid but the resource itself does not exist. Servers may also send this response instead of 403 to hide the existence of a resource.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.5",
    },
    {
      code: 405,
      name: "Method Not Allowed",
      description: "The HTTP method is not allowed for this resource.",
      detail: "The request method is known by the server but is not supported by the target resource. The server must generate an Allow header with the list of currently supported methods for the target resource.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.6",
    },
    {
      code: 406,
      name: "Not Acceptable",
      description: "No content matches the client's Accept headers.",
      detail: "Sent when the web server, after content negotiation, doesn't find any content that conforms to the criteria given by the user agent. The server should send a list of available representations.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.7",
    },
    {
      code: 407,
      name: "Proxy Authentication Required",
      description: "Authentication by a proxy server is required.",
      detail: "Similar to 401 but authentication needs to be done by a proxy. The server must include a Proxy-Authenticate header with the challenge.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.8",
    },
    {
      code: 408,
      name: "Request Timeout",
      description: "Server timed out waiting for the request.",
      detail: "The server timed out waiting for the request. Some servers send this response without a prior request by the client. It means the server would like to shut down this unused connection.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.9",
    },
    {
      code: 409,
      name: "Conflict",
      description: "Request conflicts with the current state of the resource.",
      detail: "Sent when a request conflicts with the current state of the server. Usually returned when multiple updates to a resource conflict with each other. Common when two clients attempt to update the same resource simultaneously.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.10",
    },
    {
      code: 410,
      name: "Gone",
      description: "Resource is permanently deleted and will not be available again.",
      detail: "Similar to 404, but here the condition is expected to be permanent. If you don't know whether the condition is permanent or temporary, use 404. Unlike 404, 410 tells clients to remove their cached version and links to the resource.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.11",
    },
    {
      code: 411,
      name: "Length Required",
      description: "Request must include a Content-Length header.",
      detail: "Server rejected the request because the Content-Length header field is not defined and the server requires it.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.12",
    },
    {
      code: 412,
      name: "Precondition Failed",
      description: "One or more precondition headers evaluated to false.",
      detail: "The client has indicated preconditions in its headers which the server does not meet. Used in conditional requests with If-Match, If-None-Match, or If-Unmodified-Since headers.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.13",
    },
    {
      code: 413,
      name: "Content Too Large",
      description: "Request body exceeds the server's size limit.",
      detail: "Request entity is larger than limits defined by the server. The server may close the connection or return a Retry-After header. Formerly named 'Request Entity Too Large'.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.14",
    },
    {
      code: 414,
      name: "URI Too Long",
      description: "The URL requested by the client is longer than the server will interpret.",
      detail: "The URI requested by the client is longer than the server is willing to interpret. This can occur when a client has inadvertently converted a POST request to a GET request with long query information.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.15",
    },
    {
      code: 415,
      name: "Unsupported Media Type",
      description: "Request body format is not supported by the server.",
      detail: "The media format of the requested data is not supported by the server, so the server is rejecting the request. The server should return an Accept or Accept-Encoding header with the supported formats.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.16",
    },
    {
      code: 416,
      name: "Range Not Satisfiable",
      description: "The requested range cannot be fulfilled.",
      detail: "The range specified by the Range header field in the request can't be fulfilled. It's possible that the range is outside the size of the target URI's data. The server should return a Content-Range header indicating the actual size.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.17",
    },
    {
      code: 417,
      name: "Expectation Failed",
      description: "Server cannot meet the requirements of the Expect request header.",
      detail: "The expectation indicated by the Expect request header field cannot be met by the server.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.18",
    },
    {
      code: 418,
      name: "I'm a Teapot",
      description: "Server refuses to brew coffee because it is, permanently, a teapot.",
      detail: "Any attempt to brew coffee with a teapot should result in the error code '418 I'm a teapot'. The resulting entity body MAY be short and stout. Defined in RFC 2324 as an April Fools' joke. Preserved in modern RFCs as a historical artifact.",
      rfc: "RFC 2324",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc2324",
    },
    {
      code: 421,
      name: "Misdirected Request",
      description: "Request was directed at a server that cannot produce a response.",
      detail: "The request was directed at a server that is not able to produce a response. This can be sent by a server that is not configured to produce responses for the combination of scheme and authority that are included in the request URI.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.20",
    },
    {
      code: 422,
      name: "Unprocessable Content",
      description: "Request is well-formed but has semantic errors (validation failure).",
      detail: "The server understands the content type of the request entity, and the syntax is correct, but it was unable to process the contained instructions: typically a validation error. Very common in REST APIs. Formerly called 'Unprocessable Entity' (WebDAV).",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.21",
    },
    {
      code: 423,
      name: "Locked",
      description: "Resource is locked (WebDAV).",
      detail: "The resource that is being accessed is locked. Used in WebDAV to indicate that a resource is locked and cannot be modified.",
      rfc: "RFC 4918",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc4918#section-11.3",
    },
    {
      code: 424,
      name: "Failed Dependency",
      description: "Request failed because a dependent request failed (WebDAV).",
      detail: "The method could not be performed on the resource because the requested action depended on another action and that action failed. Used in WebDAV batch operations.",
      rfc: "RFC 4918",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc4918#section-11.4",
    },
    {
      code: 425,
      name: "Too Early",
      description: "Server is unwilling to process a request that might be replayed.",
      detail: "Indicates that the server is unwilling to risk processing a request that might be replayed. Used in the context of TLS 1.3 early data to prevent replay attacks.",
      rfc: "RFC 8470",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc8470",
    },
    {
      code: 426,
      name: "Upgrade Required",
      description: "Client must switch to a different protocol.",
      detail: "The server refuses to perform the request using the current protocol but will be willing to do so after the client upgrades to a different protocol. The server must include an Upgrade header with the required protocol.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.22",
    },
    {
      code: 428,
      name: "Precondition Required",
      description: "Origin server requires the request to be conditional.",
      detail: "The origin server requires the request to be conditional. This response is intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back, when a third party has modified the state on the server.",
      rfc: "RFC 6585",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc6585#section-3",
    },
    {
      code: 429,
      name: "Too Many Requests",
      description: "Client has sent too many requests in a given time (rate limiting).",
      detail: "The user has sent too many requests in a given amount of time ('rate limiting'). The server should include a Retry-After header indicating how long to wait. Very common in REST APIs and public services.",
      rfc: "RFC 6585",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc6585#section-4",
    },
    {
      code: 431,
      name: "Request Header Fields Too Large",
      description: "Request headers are too large for the server to process.",
      detail: "The server is unwilling to process the request because its header fields are too large. The request may be resubmitted after reducing the size of the request header fields. Used for overall headers (431) or a single header (400).",
      rfc: "RFC 6585",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc6585#section-5",
    },
    {
      code: 451,
      name: "Unavailable For Legal Reasons",
      description: "Resource is unavailable due to a legal demand, such as censorship.",
      detail: "The user requested a resource that cannot legally be provided, such as a web page censored by a government. 451 is a reference to the novel 'Fahrenheit 451', where books are outlawed. The server should include a Link header pointing to the legal authority.",
      rfc: "RFC 7725",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc7725",
    },
  ],
  "5xx": [
    {
      code: 500,
      name: "Internal Server Error",
      description: "The server encountered an unexpected condition.",
      detail: "The server has encountered a situation it does not know how to handle. This is a generic catch-all error message given when an unexpected condition was encountered and no more specific message is suitable.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.1",
    },
    {
      code: 501,
      name: "Not Implemented",
      description: "The request method is not supported by the server.",
      detail: "The request method is not supported by the server and cannot be handled. The only methods required to be supported (and therefore not return 501) are GET and HEAD.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.2",
    },
    {
      code: 502,
      name: "Bad Gateway",
      description: "Server acting as a gateway received an invalid response from upstream.",
      detail: "The server, while acting as a gateway or proxy, received an invalid response from the upstream server. Usually indicates the upstream server is down or misconfigured.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.3",
    },
    {
      code: 503,
      name: "Service Unavailable",
      description: "Server is not ready to handle the request: overloaded or in maintenance.",
      detail: "The server is not ready to handle the request. Common causes are a server that is down for maintenance or is overloaded. The server should include a Retry-After header when possible.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.4",
    },
    {
      code: 504,
      name: "Gateway Timeout",
      description: "Server acting as gateway did not get a timely response from upstream.",
      detail: "The server is acting as a gateway and cannot get a response in time from the upstream server. Similar to 408, but this response comes from an intermediary rather than the actual server.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.5",
    },
    {
      code: 505,
      name: "HTTP Version Not Supported",
      description: "The HTTP version used in the request is not supported by the server.",
      detail: "The HTTP version used in the request is not supported by the server. The server should include a description of why that version is not supported and what other protocols it supports.",
      rfc: "RFC 9110",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc9110#section-15.6.6",
    },
    {
      code: 506,
      name: "Variant Also Negotiates",
      description: "Server has an internal configuration error in content negotiation.",
      detail: "The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper endpoint in the negotiation process.",
      rfc: "RFC 2295",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc2295",
    },
    {
      code: 507,
      name: "Insufficient Storage",
      description: "Server cannot store the representation needed to complete the request (WebDAV).",
      detail: "The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request. This condition is considered to be temporary.",
      rfc: "RFC 4918",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc4918#section-11.5",
    },
    {
      code: 508,
      name: "Loop Detected",
      description: "Infinite loop detected while processing the request (WebDAV).",
      detail: "The server detected an infinite loop while processing the request. The entire operation failed. Used in WebDAV to terminate a request that would otherwise loop indefinitely.",
      rfc: "RFC 5842",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc5842#section-7.2",
    },
    {
      code: 510,
      name: "Not Extended",
      description: "Further extensions to the request are required for the server to fulfill it.",
      detail: "Further extensions to the request are required for the server to fulfil it. The server should send a response describing extensions that are required.",
      rfc: "RFC 2774",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc2774",
    },
    {
      code: 511,
      name: "Network Authentication Required",
      description: "Client must authenticate to gain network access (captive portal).",
      detail: "The client needs to authenticate to gain network access. Intended for use by intercepting proxies such as captive portals; the response body should contain a link to a page where the user can submit credentials.",
      rfc: "RFC 6585",
      rfcUrl: "https://www.rfc-editor.org/rfc/rfc6585#section-6",
    },
  ],
};

const ALL_CODES: (StatusCode & { class: StatusClass })[] = (
  Object.entries(STATUS_CODES) as [StatusClass, StatusCode[]][]
).flatMap(([cls, codes]) => codes.map((c) => ({ ...c, class: cls })));

// ─── Class meta ──────────────────────────────────────────────────────────────

const CLASS_META: Record<
  StatusClass,
  { label: string; colorText: string; colorBg: string; colorBorder: string; colorBadge: string }
> = {
  "1xx": {
    label: "Informational",
    colorText: "text-sky-500",
    colorBg: "bg-sky-500/10",
    colorBorder: "border-sky-500/30",
    colorBadge: "bg-sky-500/15 text-sky-500",
  },
  "2xx": {
    label: "Success",
    colorText: "text-emerald-500",
    colorBg: "bg-emerald-500/10",
    colorBorder: "border-emerald-500/30",
    colorBadge: "bg-emerald-500/15 text-emerald-500",
  },
  "3xx": {
    label: "Redirection",
    colorText: "text-amber-500",
    colorBg: "bg-amber-500/10",
    colorBorder: "border-amber-500/30",
    colorBadge: "bg-amber-500/15 text-amber-500",
  },
  "4xx": {
    label: "Client Error",
    colorText: "text-orange-500",
    colorBg: "bg-orange-500/10",
    colorBorder: "border-orange-500/30",
    colorBadge: "bg-orange-500/15 text-orange-500",
  },
  "5xx": {
    label: "Server Error",
    colorText: "text-red-500",
    colorBg: "bg-red-500/10",
    colorBorder: "border-red-500/30",
    colorBadge: "bg-red-500/15 text-red-500",
  },
};

const CLASSES: StatusClass[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function HttpStatusCodes() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusClass | "all">("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = useCallback(
    (code: number) => setExpanded((prev) => (prev === code ? null : code)),
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_CODES.filter((c) => {
      if (filter !== "all" && c.class !== filter) return false;
      if (!q) return true;
      return (
        String(c.code).includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.detail.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  // Group results by class for display
  const grouped = useMemo(() => {
    const map = new Map<StatusClass, typeof results>();
    for (const cls of CLASSES) map.set(cls, []);
    for (const r of results) map.get(r.class)!.push(r);
    return map;
  }, [results]);

  const isSearching = query.trim() !== "" || filter !== "all";

  return (
    <ToolPageLayout
      title="HTTP Status Codes"
      description="Complete reference for all standard HTTP response codes. Click any code to expand its detail and RFC link."
      maxWidth="wide"
    >
      <ToolSEO
        title="HTTP Status Codes Reference"
        description="Complete reference for all HTTP status codes: 1xx informational, 2xx success, 3xx redirection, 4xx client errors, 5xx server errors, with descriptions, examples and RFC links."
        canonicalPath="/http-status"
        keywords={[
          "HTTP status codes",
          "HTTP response codes",
          "404 not found",
          "500 internal server error",
          "401 unauthorized",
          "403 forbidden",
          "301 redirect",
          "HTTP error codes reference",
          "REST API status codes",
        ]}
        howToSteps={[
          "Type a code number, name or keyword in the search box to filter",
          "Click a class filter button (2xx, 4xx, etc.) to show only that category",
          "Click any row to expand the full description and RFC reference",
          "Use the copy button to copy the code number to your clipboard",
        ]}
      />

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setFilter("all"); } }}
            placeholder="Search by code, name or description…"
            aria-label="Search HTTP status codes"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-[hsl(var(--border-hover))] focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <Button
              variant="ghost" size="icon"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>

        {/* Class filter pills */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status class">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className="h-7 px-3 text-xs"
            aria-pressed={filter === "all"}
          >
            All
          </Button>
          {CLASSES.map((cls) => {
            const m = CLASS_META[cls];
            return (
              <Button
                key={cls}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(filter === cls ? "all" : cls)}
                aria-pressed={filter === cls}
                className={`h-7 px-3 text-xs font-mono font-semibold border ${
                  filter === cls
                    ? `${m.colorBg} ${m.colorText} ${m.colorBorder}`
                    : "border-transparent text-muted-foreground hover:border-border"
                }`}
              >
                {cls}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      {isSearching && (
        <p className="mb-3 text-xs text-muted-foreground" role="status">
          {results.length === 0
            ? "No codes match your search."
            : `${results.length} code${results.length === 1 ? "" : "s"} found.`}
        </p>
      )}

      {/* Code groups */}
      <div className="space-y-6">
        {CLASSES.map((cls) => {
          const codes = grouped.get(cls)!;
          if (codes.length === 0) return null;
          const m = CLASS_META[cls];
          return (
            <section key={cls} aria-labelledby={`class-${cls}`}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  id={`class-${cls}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-mono font-bold ${m.colorBadge}`}
                >
                  {cls}
                </span>
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {codes.length} code{codes.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
                {codes.map((status) => {
                  const isOpen = expanded === status.code;
                  return (
                    <div key={status.code}>
                      {/* Row */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(status.code)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(status.code); } }}
                        aria-expanded={isOpen}
                        aria-controls={`detail-${status.code}`}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer bg-card hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        {/* Code badge */}
                        <span
                          className={`shrink-0 inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${m.colorBadge}`}
                          aria-label={`Status code ${status.code}`}
                        >
                          {status.code}
                        </span>

                        {/* Name + description */}
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground leading-tight">{status.name}</span>
                          <span className="block text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-1">
                            {status.description}
                          </span>
                        </div>

                        {/* Copy + expand */}
                        <div className="flex shrink-0 items-center gap-1 ml-2">
                          <CopyButton
                            value={String(status.code)}
                            ariaLabel={`Copy ${status.code}`}
                            message={`Copied ${status.code}`}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          />
                          <span
                            className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            aria-hidden
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div
                          id={`detail-${status.code}`}
                          className={`px-4 pb-4 pt-3 ${m.colorBg} border-t ${m.colorBorder}`}
                        >
                          <p className="text-sm text-foreground leading-relaxed mb-3">{status.detail}</p>
                          <div className="flex flex-wrap items-center gap-3">
                            {status.rfc && status.rfcUrl && (
                              <a
                                href={status.rfcUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-xs font-mono font-medium ${m.colorText} hover:underline focus-visible:outline-none focus-visible:underline`}
                              >
                                {status.rfc}
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            )}
                            <CopyButton
                              value={`${status.code} ${status.name}`}
                              label={`${status.code} ${status.name}`}
                              ariaLabel={`Copy "${status.code} ${status.name}"`}
                              message={`Copied "${status.code} ${status.name}"`}
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-muted-foreground"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* About */}
      <div className="mt-6">
        <AboutTool title="About HTTP Status Codes">
          <p className="text-sm text-muted-foreground">
            HTTP status codes are three-digit numbers returned by a server to indicate the result of a client's request. They are grouped into five classes:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><span className="font-semibold text-sky-500">1xx Informational:</span> The request was received and the server is continuing to process it.</li>
            <li><span className="font-semibold text-emerald-500">2xx Success:</span> The request was successfully received, understood and accepted.</li>
            <li><span className="font-semibold text-amber-500">3xx Redirection:</span> Further action is needed to complete the request.</li>
            <li><span className="font-semibold text-orange-500">4xx Client Error:</span> The request contains bad syntax or cannot be fulfilled by the server.</li>
            <li><span className="font-semibold text-red-500">5xx Server Error:</span> The server failed to fulfill an apparently valid request.</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Status codes are defined in <a href="https://www.rfc-editor.org/rfc/rfc9110" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">RFC 9110</a> (HTTP Semantics) and extended by additional RFCs for WebDAV, rate limiting, and other extensions.
          </p>
        </AboutTool>
      </div>
    </ToolPageLayout>
  );
}
