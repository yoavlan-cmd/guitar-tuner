# Builds mx_stub.onnx: a stand-in for the HT-Demucs 6-stem model with the same input/output shapes.
# input x [1, 2, S] -> output [1, 6, 2, S]: drums = 0.4 * x, guitar = 0.6 * x, other parts silent.
# Run: python3 tests/fixtures/make_mx_stub.py  (needs `pip install onnx`)
import onnx, numpy as np, os
from onnx import helper, TensorProto, numpy_helper
w = np.zeros((1, 6, 1, 1), np.float32); w[0, 0] = .4; w[0, 4] = .6   # stems: drums bass other vocals guitar piano
g = helper.make_graph(
    [helper.make_node('Unsqueeze', ['x', 'ax'], ['u']), helper.make_node('Mul', ['u', 'w'], ['y'])], 'mx_stub',
    [helper.make_tensor_value_info('x', TensorProto.FLOAT, [1, 2, 'S'])],
    [helper.make_tensor_value_info('y', TensorProto.FLOAT, [1, 6, 2, 'S'])],
    [numpy_helper.from_array(w, 'w'), numpy_helper.from_array(np.array([1], np.int64), 'ax')])
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 13)]); m.ir_version = 8
onnx.checker.check_model(m); onnx.save(m, os.path.join(os.path.dirname(__file__), 'mx_stub.onnx'))
