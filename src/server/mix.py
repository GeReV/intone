import torch
bella = torch.load('voices/af_bella.pt', weights_only=True)
sarah = torch.load('voices/af_sarah.pt', weights_only=True)
af = torch.mean(torch.stack([bella, sarah]), dim=0)
assert torch.equal(af, torch.load('voices/af.pt', weights_only=True))
