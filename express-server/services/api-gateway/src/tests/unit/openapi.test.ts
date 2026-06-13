import { openApiDocument } from '../../docs/openapi';

describe('openApiDocument', () => {
  it('exposes gateway metadata', () => {
    expect(openApiDocument.openapi).toBe('3.0.3');
    expect(openApiDocument.info.title).toBe('DevDocs Studio API');
  });
});
