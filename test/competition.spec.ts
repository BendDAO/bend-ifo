import rawBRE from 'hardhat';
import BigNumber from 'bignumber.js';

import {
  deployBendCompetition,
  deployCryptoPunksMarket,
  deployMintableERC20,
  deployMintableERC721,
  deployTreasury,
  deployWETHGateway,
} from '../helpers/contracts-deployments';
import { DRE, waitForTx } from '../helpers/misc-utils';
import {
  BendCompetition,
  CryptoPunksMarket,
  MintableERC20,
  MintableERC721,
} from '../types';
import {
  getEthersSigners,
  getSecondSigner,
} from '../helpers/contracts-getters';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';

describe('Competition', async () => {
  const oneBend = new BigNumber(1).shiftedBy(18);
  const oneETH = new BigNumber(1).shiftedBy(18);

  before(async () => {
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    await rawBRE.run('set-DRE');
  });

  it('should claim with erc721', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const erc721Token = await deployMintableERC721(['ERC721 Token', 'NFT']);

    const bendCompetition = await deployBendCompetition([
      {
        TARGET_ETH_PAYMENT: oneETH.multipliedBy(5000).toFixed(0),
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 80,
        BLOCK_RANGE: ['0', '999999999'],
        BEND_TOKEN_REWARD_PER_ETH_PER_NFT: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_NFT: oneETH.toFixed(0),
      },
      {
        WETH_GATEWAY: ZERO_ADDRESS,
        TREASURY: ZERO_ADDRESS,
        BEND_TOKEN: bendToken.address,
        CRYPTO_PUNKS: ZERO_ADDRESS,
        ERC721_NFT: [erc721Token.address],
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');

    await waitForTx(await erc721Token.connect(secondSigner).mint(1));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.toFixed(0),
      })
    );

    [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);

    expect(competitionBalance.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(secondSignerBalane.toString()).to.equal(oneBend.div(2).toFixed(0));
  });

  it('should claim crypto punks', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const cryptoPunksMarket = await deployCryptoPunksMarket([]);
    await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());

    const bendCompetition = await deployBendCompetition([
      {
        TARGET_ETH_PAYMENT: oneETH.multipliedBy(5000).toFixed(0),
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 80,
        BLOCK_RANGE: ['0', '999999999'],
        BEND_TOKEN_REWARD_PER_ETH_PER_NFT: oneBend.div(4).toFixed(0),
        MAX_ETH_PAYMENT_PER_NFT: oneETH.toFixed(0),
      },
      {
        WETH_GATEWAY: ZERO_ADDRESS,
        TREASURY: ZERO_ADDRESS,
        BEND_TOKEN: bendToken.address,
        CRYPTO_PUNKS: cryptoPunksMarket.address,
        ERC721_NFT: [],
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');

    await waitForTx(await cryptoPunksMarket.connect(secondSigner).getPunk(1));
    await waitForTx(await cryptoPunksMarket.connect(secondSigner).getPunk(2));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithCryptoPunks([1, 2], {
        value: oneETH.multipliedBy(2).toFixed(0),
      })
    );

    [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(secondSignerBalane.toString()).to.equal(oneBend.div(2).toFixed(0));
  });

  it('should draw dividend', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const erc721Token = await deployMintableERC721(['ERC721 Token', 'NFT']);
    const wethGateway = await deployWETHGateway([]);
    const treasury = await deployTreasury([]);

    const bendCompetition = await deployBendCompetition([
      {
        TARGET_ETH_PAYMENT: oneETH.multipliedBy(5000).toFixed(0),
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 80,
        BLOCK_RANGE: ['0', '999999999'],
        BEND_TOKEN_REWARD_PER_ETH_PER_NFT: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_NFT: oneETH.toFixed(0),
      },
      {
        WETH_GATEWAY: wethGateway.address,
        TREASURY: treasury.address,
        BEND_TOKEN: bendToken.address,
        CRYPTO_PUNKS: ZERO_ADDRESS,
        ERC721_NFT: [erc721Token.address],
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [competitionBalance, secondSignerBalane, ethPaymentTotal, dividend] =
      await Promise.all([
        bendToken.balanceOf(bendCompetition.address),
        bendToken.balanceOf(await secondSigner.getAddress()),
        bendCompetition.ethPaymentTotal(),
        bendCompetition.dividend(),
      ]);
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');
    expect(ethPaymentTotal.toString()).to.equal('0');
    expect(dividend.toString()).to.equal('0');

    await waitForTx(await erc721Token.connect(secondSigner).mint(1));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.toFixed(0),
      })
    );

    [competitionBalance, secondSignerBalane, ethPaymentTotal, dividend] =
      await Promise.all([
        bendToken.balanceOf(bendCompetition.address),
        bendToken.balanceOf(await secondSigner.getAddress()),
        bendCompetition.ethPaymentTotal(),
        bendCompetition.dividend(),
      ]);

    expect(competitionBalance.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(secondSignerBalane.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(ethPaymentTotal.toString()).to.equal(oneETH.toFixed(0));
    expect(dividend.toString()).to.equal(oneETH.toFixed(0));

    await waitForTx(await bendCompetition.drawDividend());
    [ethPaymentTotal, dividend] = await Promise.all([
      bendCompetition.ethPaymentTotal(),
      bendCompetition.dividend(),
    ]);

    const [poolBalance, treasuryBalance] = await Promise.all([
      wethGateway.balanceOf(await firstSigner.getAddress()),
      treasury.balance(),
    ]);

    expect(ethPaymentTotal.toString()).to.equal(oneETH.toFixed(0));
    expect(dividend.toString()).to.equal('0');
    expect(poolBalance.toString()).to.equal(
      oneETH.multipliedBy(0.8).toFixed(0)
    );
    expect(treasuryBalance.toString()).to.equal(
      oneETH.multipliedBy(0.2).toFixed(0)
    );
  });

  it('should auto draw dividend', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const erc721Token = await deployMintableERC721(['ERC721 Token', 'NFT']);
    const wethGateway = await deployWETHGateway([]);
    const treasury = await deployTreasury([]);

    const bendCompetition = await deployBendCompetition([
      {
        TARGET_ETH_PAYMENT: oneETH.multipliedBy(5000).toFixed(0),
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 80,
        BLOCK_RANGE: ['0', '999999999'],
        BEND_TOKEN_REWARD_PER_ETH_PER_NFT: oneBend.div(1000).toFixed(0),
        MAX_ETH_PAYMENT_PER_NFT: oneETH.multipliedBy(1000).toFixed(0),
      },
      {
        WETH_GATEWAY: wethGateway.address,
        TREASURY: treasury.address,
        BEND_TOKEN: bendToken.address,
        CRYPTO_PUNKS: ZERO_ADDRESS,
        ERC721_NFT: [erc721Token.address],
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [ethPaymentTotal, dividend] = await Promise.all([
      bendCompetition.ethPaymentTotal(),
      bendCompetition.dividend(),
    ]);
    expect(ethPaymentTotal.toString()).to.equal('0');
    expect(dividend.toString()).to.equal('0');

    await waitForTx(await erc721Token.connect(secondSigner).mint(1));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.toFixed(0),
      })
    );

    [ethPaymentTotal, dividend] = await Promise.all([
      bendCompetition.ethPaymentTotal(),
      bendCompetition.dividend(),
    ]);

    expect(ethPaymentTotal.toString()).to.equal(oneETH.toFixed(0));
    expect(dividend.toString()).to.equal(oneETH.toFixed(0));

    let [poolBalance, treasuryBalance] = await Promise.all([
      wethGateway.balanceOf(await firstSigner.getAddress()),
      treasury.balance(),
    ]);

    expect(poolBalance.toString()).to.equal('0');
    expect(treasuryBalance.toString()).to.equal('0');

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.multipliedBy(100).toFixed(0),
      })
    );

    [ethPaymentTotal, dividend] = await Promise.all([
      bendCompetition.ethPaymentTotal(),
      bendCompetition.dividend(),
    ]);

    expect(ethPaymentTotal.toString()).to.equal(
      oneETH.multipliedBy(101).toFixed(0)
    );
    expect(dividend.toString()).to.equal('0');

    [poolBalance, treasuryBalance] = await Promise.all([
      wethGateway.balanceOf(await firstSigner.getAddress()),
      treasury.balance(),
    ]);

    expect(poolBalance.toString()).to.equal(
      oneETH.multipliedBy(101).multipliedBy(0.8).toFixed(0)
    );
    expect(treasuryBalance.toString()).to.equal(
      oneETH.multipliedBy(101).multipliedBy(0.2).toFixed(0)
    );
  });
});
