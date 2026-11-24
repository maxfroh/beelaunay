import numpy as np
from scipy.optimize import curve_fit

x = np.array([17.34, 11.38, 13.47, 15.55, 7.16, 24.06, 19.5, 12.58, 17.85, 10.33,
             7.45, 18.36, 14.73, 20.38, 8.35, 6.67, 5.3, 0.02, 7.72, 9.25, 7.37, 16.78, 16.17])
y = np.array([0.589, 0.98, 0.994, 0.96, 0.271, 0, 0.09, 0.996, 0.382, 0.968,
             0.65, 0.25, 0.984, 0.03, 0.856, 0.107, 0, 0, 0.774, 0.944, 0.38, 0.8, 0.877])

EPSILON = 1e-10

def model(x, a, k1, s1, k2, s2, c):
    X = x / 24
    rise = 1.0 / (1.0 + np.exp(-(X - k1) / s1))
    fall = 1.0 / (1.0 + np.exp((X - k2) / s2))
    out = a * rise * fall + c
    return out

p0 = [1.0, 0.33, 0.03, 17.5 / 24, 0.8 / 24, -1]

bounds = (
    [0, 0, 0, 0, 0, -1], 
    [2, 6, 2, 3, 2, 2]
)

popt, pcov = curve_fit(model, x, y, p0=p0, bounds=bounds)
y_pred = model(x, *popt)
r2 = 1 - np.sum((y - y_pred) ** 2) / np.sum((y - np.mean(y)) ** 2)


print("[a, k1, s1, k2, s2, c]:", popt)
print(f"R^2: {r2:.4f}")