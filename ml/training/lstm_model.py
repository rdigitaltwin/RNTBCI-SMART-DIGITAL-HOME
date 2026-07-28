import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np

class EnergyLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super(EnergyLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc1 = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 1)

    def forward(self, x):
        # x shape: (batch, seq_len, features)
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        out, _ = self.lstm(x, (h0, c0))
        
        # We take the output of the last time step
        out = out[:, -1, :]
        
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out)
        return out

class TimeSeriesDataset(Dataset):
    def __init__(self, X, y, seq_len=12):
        self.X = X
        self.y = y
        self.seq_len = seq_len

    def __len__(self):
        return len(self.X) - self.seq_len

    def __getitem__(self, idx):
        # returns (seq_len, features) and (1) target
        return (
            torch.tensor(self.X[idx : idx + self.seq_len], dtype=torch.float32),
            torch.tensor(self.y[idx + self.seq_len], dtype=torch.float32)
        )

def create_dataloaders(X, y, seq_len=12, batch_size=64):
    dataset = TimeSeriesDataset(X, y, seq_len)
    
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, val_loader
