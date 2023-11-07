import * as React from 'react';
import { CEPH_STORAGE_NAMESPACE } from '@odf/shared/constants';
import { render } from '@testing-library/react';
import CreateNamespaceStore from './create-namespace-store';

const params = {
  ns: 'test-ns',
};

const mockNamespaceStoreForm = jest.fn();
jest.mock('./namespace-store-form', () => (props) => {
  mockNamespaceStoreForm(props);
  return <mock-NamespaceStoreForm />;
});

describe('CreateNamespaceStore test', () => {
  it('shows the correct heading texts', () => {
    const { container } = render(<CreateNamespaceStore match={{ params }} />);
    const heading = container.getElementsByClassName(
      'odf-create-operand__header-text'
    )[0];
    const titleHeading = container.getElementsByClassName('help-block')[0];
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/Create NamespaceStore/);
    expect(titleHeading).toBeInTheDocument();
    expect(titleHeading).toHaveTextContent(
      /Represents an underlying storage to be used as read or write target for the data in the namespace buckets\./
    );
  });

  it('Check the title size and heading level', () => {
    const { container } = render(<CreateNamespaceStore match={{ params }} />);
    const fontSize = container.getElementsByClassName('pf-m-2xl')[0];
    expect(fontSize).toBeInTheDocument();
    expect(
      container.querySelectorAll('h1.odf-create-operand__header-text')[0]
    ).toBeTruthy();
  });

  it('pass the received namespace to the form', () => {
    render(<CreateNamespaceStore match={{ params }} />);
    expect(mockNamespaceStoreForm).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'test-ns',
      })
    );
  });

  it('pass the default namespace to the form when no namespace is received', () => {
    render(<CreateNamespaceStore match={{ params: {} }} />);
    expect(mockNamespaceStoreForm).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: CEPH_STORAGE_NAMESPACE,
      })
    );
  });
});
